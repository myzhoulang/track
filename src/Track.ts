import utils from "./utils";
import $base_properties from "./base_properties";
import auto_track from "./auto_track";
import search_engine from "./search_engine";
import { LinkTrack, FormTrack } from "./dom_track";
import store from "./Store";
import "./history";

const querystring = require("query-string");

// ✔️ TODO: search engine
// ✔️ TODO: QueryParams
// ✔️ TODO: DOMTRACK
// TODO: Cookie/localstorage
// ✔ TODO: 路由切换收集(区分是否SPA)
// TODO: 计算两个track 之间的时间 (x)
// ✔️ TODO: 敏感数据列表
// ✔️ TODO: 单一和批量发送数据 https://manual.sensorsdata.cn/sa/latest/tech_sdk_client_web_use-7538919.html
// TODO: 内置一些埋点事件 $pageview $pageleave $input_time $page_load

interface batchSendConfig {
  max_length?: number;
  timeout?: number;
  interval?: number;
}

interface TrackOptions {
  callback_fired?: boolean;
  href?: string;
  new_tab?: boolean;
  element?: Element | HTMLFormElement;
}

interface trackResponse {
  status?: number;
  message?: string;
  responce?: object;
}

interface sendOptions {
  timeout?: number;
}

interface config {
  auto_track: boolean;
  track_pageview: boolean;
  track_input_time: boolean;
  track_elements_blacklist: string[];
  request_type: string;
  track_property_blacklist: string[];
  track_link_timeout: number;
  api_host: string;
  lib_instance_name: string;
  filter_sensitive_data: boolean;
  track_single_page: boolean;
  batch_send: boolean | batchSendConfig;
  [key: string]: any;
}
interface User {
  name?: string;
  email?: string;
}

// TODO: 常量抽取到常量文件中
const batch_send_default_options = {
  max_length: 10,
  timeout: 5000,
  interval: 10000
};

const store_key = "$batch_track_data";
const inner_events = "$pageview $pageleave $input_time $page_load".split(" ");

// const ua = JSON.stringify({ ua: navigator.userAgent, now: performance.now() });
// const headers = { type: 'application/json' };
// const blob = new Blob([ua], headers);
// const blob = new Blob([`room_id=123`], {
//   type: "application/x-www-form-urlencoded"
// });
// navigator.sendBeacon("http://127.0.0.1:3000/api/track", blob);

class Track {
  // 用户信息
  private public_data: object;
  private readonly config: config;

  constructor(config?: config) {
    this.config = Object.assign(
      {
        api_host: "http://127.0.0.1:3000/api/track",
        auto_track: true,
        lib_instance_name: "ph",
        track_pageview: true,
        track_input_time: true,
        track_link_timeout: 300,
        track_elements_blacklist: ["body"],
        track_property_blacklist: ["style", "data-row-key"],
        filter_sensitive_data: true,
        request_type: "XHR",
        batch_send: batch_send_default_options
      },
      config
    );

    if (!this.config["api_host"]) {
      console.error("api_host为空，初始化失败");
      return;
    }

    // @ts-ignore
    window[this.getConfig("lib_instance_name")] = this;

    // auto_track
    if (this.getConfig("auto_track")) {
      console.log("auto track");
      this.auto_track();
    }
    // track_pageview
    if (this.getConfig("track_pageview")) {
      this.track_pageview();
    }

    // 是否开启batch_send
    // 开启批量处理的时候在页面刷新、跳转导致刷新、关闭的时候会导致
    // 存在localStorage 中未上报的数据没有时机发送。
    // 需要监听 window.onunload 事件，在onunload 事件中 使用 navigator.sendBeacon() 发送数据
    // 使用加载图片方式或ajax同步请求会导致页面的延迟卸载，影响用户体验。
    // navigator.sendBeacon方法将请求放到浏览器发送队列，并且不会延迟页面的卸载
    // 但navigator.sendBeacon也有缺点：
    //    1. 受到队列总数和数据大小可能放入队列失败，
    //    2. 无法保证发送成功，客户端也无法监听任何事件。
    //    3. 兼容性也是一个问题
    // navigator.sendBeacon: https://developer.mozilla.org/zh-CN/docs/Web/API/Navigator/sendBeacon
    if (this.is_batch_send()) {
      this.batch_send();
      utils.addEvent(window, "beforeunload", this.send_beacon.bind(this));
      utils.addEvent(window, "online", this.send_beacon.bind(this));
    }

    // 是否开启表单输入控件 输入时间耗时
    if (this.getConfig("track_input_time")) {
      this.track_input_time();
    }
  }

  public auto_track() {
    auto_track.init(this);
  }

  // 设置登录用户信息
  public add_public_data(data: object) {
    this.public_data = data;
  }

  // track
  public track(
    event_name: string,
    props: object = {},
    options?: TrackOptions,
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
        ...this.public_data,
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

    // 判断是否需要批量处理
    // 不批量处理或者内置的事件就直接发送
    // 批量处理就将数据存储到store

    if (!this.is_batch_send() || inner_events.indexOf(event_name) !== -1) {
      this.send_request(data, {}, (res: trackResponse) => {
        // 如果失败将失败数据存储到localStorage
        if (res.status !== 200) {
          store.arrayAppend(store_key, data);
        }
      });
    } else {
      store.arrayAppend(store_key, data);
    }
  }

  // 是否批量处理
  is_batch_send(): boolean {
    const batch_send_config: boolean | batchSendConfig = this.getConfig(
      "batch_send"
    );
    // 如果
    if (utils.isBoolean(batch_send_config) && batch_send_config === false) {
      return false;
    }

    return true;
  }

  send_beacon(e: Event) {
    console.log("send_beacon");
    const url = this.getConfig("api_host");
    const data = store.get(store_key);
    if (data.length < 1) {
      return;
    }

    // 判断是否进入队列
    // 进入队列就默认发送成功
    // 清空数据
    const blob = new Blob([JSON.stringify(data)], {
      type: "application/x-www-form-urlencoded"
    });
    if (navigator.sendBeacon(url, blob)) {
      store.set(store_key, []);
    }
  }
  // batch
  batch_send() {
    const batchConfig: batchSendConfig | boolean = this.getConfig("batch_send");
    const config: batchSendConfig = utils.isBoolean(batchConfig)
      ? batch_send_default_options
      : (batchConfig as batchSendConfig);
    const _this = this;

    function send() {
      const data = store.get(store_key);
      const callback: (res: trackResponse) => void = (res: trackResponse) => {
        if (res.status === 200) {
          data.splice(0, config.max_length);
          store.set(store_key, data);
        }
      };
      if (Array.isArray(data) && data.length > 0) {
        _this.send_request(
          data.slice(0, config.max_length),
          { timeout: config.timeout },
          callback
        );
      }
      // 判断网络是否正常
      // 网络正常能访问才会走轮询
      if (utils.isOnline) {
        setTimeout(send, config.interval);
      }
    }
    send();
  }

  private send_request(
    data: object,
    options: sendOptions,
    callback: (res: trackResponse) => void = utils.noop
  ) {
    // 当前无网络状态下直接将上报数据保存到localStorage
    if (!utils.isOnline) {
      store.arrayAppend(store_key, data);
      return;
    }

    const request_type = this.getConfig("request_type");
    const url = this.getConfig("api_host");
    const _callback: (res: trackResponse) => void = (res: trackResponse) => {
      callback(res);
    };
    switch (request_type) {
      case "image":
        this.image_request(url, data, options, _callback);
        break;

      case "XHR":
        this.ajax_request(url, data, options, _callback);
        break;
    }
  }

  // image request
  private image_request(
    url: string,
    data: object,
    options: sendOptions,
    callback: (arg: trackResponse) => void = utils.noop
  ) {
    const image = new Image();
    image.onload = () => {
      callback({ status: 200 });
    };
    image.onerror = () => {
      console.error(`上报失败: data = ${JSON.stringify(data)}`);
      callback({ status: 600 });
    };
    image.src = querystring.stringifyUrl({ url, query: data });
  }

  // ajax
  private ajax_request(
    url: string,
    data: object,
    options: sendOptions,
    callback: (res: object) => void = utils.noop
  ) {
    const req = new XMLHttpRequest();
    req.open("POST", url, true);
    req.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
    // req.withCredentials = true;
    req.timeout = options.timeout;

    req.onreadystatechange = () => {
      if (req.readyState === 4) {
        if (req.status === 200) {
          try {
            const response = JSON.parse(req.responseText);
            callback({ status: req.status, response });
          } catch (e) {
            console.error(e);
          }
        } else {
          console.error(`上报失败: data = ${JSON.stringify(data)}`);
          callback({ status: req.status, error: `ajax: ${url}请求失败` });
        }
      }
    };
    if (!Array.isArray(data)) {
      data = [data];
    }
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
    // const referrer = querystring.parseUrl(document.referrer);
    // const current = querystring.parseUrl(page);
    this.track("ph_page_view", { page });
    const track_single_page = this.getConfig("track_single_page");

    if (track_single_page) {
      // 这里的 popsate 事件能监听到 history.pushState 和 history.replaceState
      // history.ts 文件中已经重写了
      utils.addEvent(window, "popstate", () => {
        this.track("ph_page_view", { page: document.location.href });
      });
    }
  }

  public track_input_time() {
    document.body.addEventListener("focusin", (event: Event) => {
      const el: HTMLInputElement = event.target as HTMLInputElement;
      const tag_type: string = el.getAttribute("type");
      // 只对输入控件
      if (
        (utils.isTag(el, "input") &&
          ["text", "number"].indexOf(tag_type) !== -1) ||
        utils.isTag(el, "textarea")
      ) {
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
