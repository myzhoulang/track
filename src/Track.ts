import utils from "./utils";
import $base_properties from "./base_properties";
import auto_track from "./auto_track";
import search_engine from "./search_engine";
import { LinkTrack, FormTrack } from "./dom_track";

const querystring = require("query-string");

// ✔️ TODO: search engine
// ✔️ TODO: QueryParams
// ✔️ TODO: DOMTRACK
// TODO: Cookie/localstorage
// TODO: 路由切换收集(区分是否SPA)
// TODO: 计算两个track 之间的时间 (x)
// ✔️ TODO: 敏感数据列表
// TODO: 单一和批量发送数据 https://manual.sensorsdata.cn/sa/latest/tech_sdk_client_web_use-7538919.html
// TODO: 内置一些埋点事件 $pageview $pageleave $input_time $page_load

interface config {
  auto_track: boolean;
  track_pageview: boolean;
  track_elements_blacklist: string[];
  request_type: string;
  track_property_blacklist: string[];
  track_link_timeout: number;
  api_host: string;
  lib_instance_name: string;
  filter_sensitive_data: boolean;
  track_single_page: boolean;
  batch_send: boolean;
  [key: string]: any;
}
interface User {
  name?: string;
  email?: string;
}

class Track {
  // 用户信息
  private user: User;
  private readonly config: config;

  constructor(config?: config) {
    this.config = Object.assign(
      {
        api_host: "http://127.0.0.1:8081/api",
        auto_track: true,
        lib_instance_name: "ph",
        track_pageview: true,
        track_link_timeout: 300,
        track_elements_blacklist: ["body"],
        track_property_blacklist: ["style", "data-row-key"],
        filter_sensitive_data: true,
        request_type: "XHR"
      },
      config
    );

    if(!this.config['api_host']){

    }

    // @ts-ignore
    window[this.getConfig("lib_instance_name")] = this;

    // auto_track
    if (this.getConfig("auto_track")) {
      console.log("auto");
      this.auto_track();
    }
    // track_pageview
    if (this.getConfig("track_pageview")) {
      this.track_pageview();
    }

    this.track_input_time();
  }

  public auto_track() {
    auto_track.init(this);
  }

  // 设置登录用户信息
  public setUser(user: User) {
    this.user = user;
  }

  // track
  public track(
    event_name: string,
    props: object = {},
    options: object = {},
    callback: () => void = utils.noop
  ) {
    if (utils.isUndefined(event_name)) {
      console.log("event_name 不能为空");
      return;
    }
    const referrer = document.referrer;

    // 搜索引擎的数据
    // 收集从搜索引擎搜索跳转过来的数据
    const $search_engine = {
      $engine: search_engine.get_search_engine(referrer),
      $keyword: search_engine.get_search_keyword(referrer)
    };

    // 当前页面的数据
    const $current_page = {
      $url: window.location.href,
      $referrer: referrer,
      $title: document.title,
      $query: utils.getQueryParams()
    };

    // 组装数据
    const properties = Object.assign(
      {
        user: this.user,
        $search_engine,
        $current_page,
        $base_properties
      },
      props
    );
    const track_property_blacklist = this.getConfig("track_property_blacklist");
    if (Array.isArray(track_property_blacklist)) {
      track_property_blacklist.forEach(item => {
        // @ts-ignore
        delete properties[item];
      });
    }
    const data = utils.strip_empty_properties({
      event_name,
      properties
    });

    this.send_request(data, {}, callback);
  }

  private send_request(
    data: object,
    options: object = {},
    callback: () => void = utils.noop
  ) {
    const request_type = this.getConfig("request_type");
    const url = this.getConfig("api_host");

    switch (request_type) {
      case "image":
        this.image_request(url, data, callback);
        break;

      case "XHR":
        this.ajax_request(url, data, callback);
        break;
    }
  }

  // image request
  private image_request(
    url: string,
    data: object,
    callback: (status: number) => void = utils.noop
  ) {
    const image = new Image();
    image.onload = () => {
      callback(1);
    };
    image.onerror = () => {
      callback(0);
    };
    image.src = querystring.stringifyUrl({ url, query: data });
  }

  // ajax
  private ajax_request(
    url: string,
    data: object,
    callback: (res: object) => void = utils.noop
  ) {
    const req = new XMLHttpRequest();
    req.open("POST", url, true);
    req.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
    req.withCredentials = true;

    req.onreadystatechange = () => {
      if (req.readyState === 4) {
        if (req.status === 200) {
          try {
            const response = JSON.parse(req.responseText);
            callback(response);
          } catch (e) {
            console.error(e);
          }
        } else {
          callback({ status: req.status, error: `ajax: ${url}请求失败` });
        }
      }
    };

    req.send(JSON.stringify(data));
  }

  // 获取指定的配置项
  public getConfig(key: string): any {
    const value: boolean | string[] | string | number = this.config[key];
    if (utils.isUndefined(value)) {
      return null;
    }
    return value;
  }

  // track-pageview
  public track_pageview(page: string = document.location.href) {
    this.track("ph_page_view", { page });
  }

  public track_input_time() {
    document.body.addEventListener("focusin", (event: Event) => {
      const el: HTMLInputElement = event.target as HTMLInputElement;
      const tag_type: string = el.getAttribute('type');
      // 只对输入控件
      if (
        (utils.isTag(el, 'input') && ['text', 'number'].indexOf(tag_type) !== -1)
        || utils.isTag(el,'textarea')) {
        // 如果当前元素是 input 输入框
        el.dataset.focus_time = String(Date.now());
        el.dataset.focus_value = el.value;
      }
    });

    // 监听 focusout 事件，会在 input 失去焦点时触发，此事件支持冒泡
    document.body.addEventListener("focusout", (event: Event) => {
      // const target = event.target;
      const target: HTMLInputElement = event.target as HTMLInputElement;
      const tag_name: string = target.tagName.toLowerCase();
      if (tag_name === "input") {
        // 如果当前元素是 input 输入框
        const now = new Date().valueOf();

        const begin_time: number = parseInt(target.dataset.focus_time, 10);
        const requestData = {
          input_name: target.name,
          begin_time: parseInt(target.dataset.focus_time),
          end_time: now,
          event_duration: now - begin_time,
          previous_value: target.dataset.focus_value,
          after_value: target.value
        };
        // 调用 track() 方法发送自定义事件
        this.track("$input_time", { $input_time: requestData });
      }
    });
  }

  // dom track
  track_link(
    querySelector: string | Node,
    event_name: string,
    props: object,
    callback?: () => void
  ) {
    const link: LinkTrack = new LinkTrack(this);
    link.track(querySelector, event_name, props, callback);
  }

  track_form(
    querySelector: string | Node,
    event_name: string,
    props: object,
    callback?: () => void
  ) {
    const link: FormTrack = new FormTrack(this);
    link.track(querySelector, event_name, props, callback);
  }
}

export default Track;
