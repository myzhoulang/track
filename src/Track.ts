import utils from "./utils";
import $base_properties from "./base_properties";
import auto_track from "./auto_track";
import search_engine from "./search_engine";
import { LinkTrack, FormTrack } from "./dom_track";
import { send_request, send_store, seed_batch } from "./request";
import { STORE_KEY, EVENTS, BATCH_SEND_DEFAULT_OPTIONS } from "./const";
import store from "./Store";
import "./polyfill";

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
  response?: object;
}

interface TrackConfigOptions {
  auto_track?: boolean;
  track_pageview?: boolean;
  track_input_time?: boolean;
  track_elements_blacklist?: string[];
  request_type?: string;
  track_property_blacklist?: string[];
  track_link_timeout?: number;
  api_host?: string;
  lib_instance_name?: string;
  filter_sensitive_data?: boolean;
  track_single_page?: boolean;
  batch_send?: boolean | batchSendConfig;
  [key: string]: any;
}

class Track {
  // 用户信息
  private public_data: object;
  private readonly config: TrackConfigOptions;
  private send_request = send_request.bind(this);
  private send_store = send_store.bind(this);
  private seed_batch = seed_batch.bind(this);

  constructor(config?: { batch_send: boolean }) {
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
        batch_send: BATCH_SEND_DEFAULT_OPTIONS
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
      this.seed_batch();
      utils.addEvent(window, "beforeunload", this.send_store.bind(this));
      utils.addEvent(window, "online", this.send_store.bind(this));
    }

    // 是否开启表单输入控件 输入时间耗时
    if (this.getConfig("track_input_time")) {
      this.track_input_time();
    }
  }

  public auto_track() {
    auto_track.init(this);
  }

  // 手动添加公共数据
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

    if (!this.is_batch_send() || EVENTS.indexOf(event_name) !== -1) {
      debugger;
      this.send_request(data, {}, (res: trackResponse) => {
        // 如果失败将失败数据存储到localStorage
        if (res.status !== 200) {
          store.arrayAppend(STORE_KEY, data);
        }
      });
    } else {
      store.arrayAppend(STORE_KEY, data);
    }
  }

  // 是否批量处理
  private is_batch_send(): boolean {
    const batch_send_config: boolean | batchSendConfig = this.getConfig(
      "batch_send"
    );

    if (utils.isBoolean(batch_send_config) && batch_send_config === false) {
      return false;
    }

    return true;
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
      // 这里的 popstate 事件能监听到 history.pushState 和 history.replaceState
      // polyfill.ts 文件中已经重写了
      utils.addEvent(window, "popstate", () => {
        this.track("ph_page_view", { page: document.location.href });
      });
    }
  }

  public track_input_time() {
    function onFocusin(e: Event) {
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
    }

    function onFocusout(e: Event) {
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
    }

    utils.addEvent(document.body, "focusin", onFocusin.bind(this));
    utils.addEvent(document.body, "focusout", onFocusout.bind(this));

    // document.body.addEventListener("focusin", (event: Event) => {
    //   const el: HTMLInputElement = event.target as HTMLInputElement;
    //   const tag_type: string = el.getAttribute("type");
    //   // 只对输入控件
    //   if (
    //     (utils.isTag(el, "input") &&
    //       ["text", "number"].indexOf(tag_type) !== -1) ||
    //     utils.isTag(el, "textarea")
    //   ) {
    //     // 如果当前元素是 input 输入框
    //     el.dataset.focus_time = String(Date.now());
    //     el.dataset.focus_value = el.value;
    //   }
    // });

    // 监听 focusout 事件，会在 input 失去焦点时触发，此事件支持冒泡
    // document.body.addEventListener("focusout", (event: Event) => {
    //   // const target = event.target;
    //   const target: HTMLInputElement = event.target as HTMLInputElement;
    //   const tag_name: string = target.tagName.toLowerCase();
    //   if (tag_name === "input") {
    //     // 如果当前元素是 input 输入框
    //     const now = new Date().valueOf();
    //
    //     const begin_time: number = parseInt(target.dataset.focus_time, 10);
    //     const requestData = {
    //       input_name: target.name,
    //       begin_time: parseInt(target.dataset.focus_time),
    //       end_time: now,
    //       event_duration: now - begin_time,
    //       previous_value: target.dataset.focus_value,
    //       after_value: target.value
    //     };
    //     // 调用 track() 方法发送自定义事件
    //     this.track("$input_time", { $input_time: requestData });
    //   }
    // });
  }

  // dom track
  public track_link(
    querySelector: string | Node,
    event_name: string,
    props: object,
    callback?: () => void
  ) {
    const link: LinkTrack = new LinkTrack(this);
    link.track(querySelector, event_name, props, callback);
  }

  public track_form(
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
