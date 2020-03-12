import utils from "./utils";
import base_properties from "./base_properties";
import auto_track from "./auto_track";

// TODO: search engine
// TODO: QueryParams
// TODO: DOMTRACK
// TODO: Cookie/localstorage
// TODO: 路由切换收集(区分是否SPA)
// TODO: 计算两个track 之间的时间
// TODO: 敏感数据列表
// TODO: 单一和批量发送数据
// TODO: 内置一些埋点事件 $pageview $pageleave $input_time

interface config {
  auto_track: boolean;
  track_pageview: boolean;
  track_elements_blacklist: string[];
  request_type: string;
  track_property_blacklist: string[];
  track_link_timeout: number;
  api_host: string;
  lib_instance_name: string;
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
        request_type: "XHR"
      },
      config
    );
  }

  // 设置登录用户信息
  setUser(user: User) {
    this.user = user;
  }

  init() {
    // @ts-ignore
    window[this.getConfig("lib_instance_name")] = this;
    console.log("auto1");
    // auto_track
    if (this.getConfig("auto_track")) {
      console.log("auto");
      auto_track.init(this);
    }
    // track_pageview
    if (this.getConfig("track_pageview")) {
      this.track_pageview();
    }
  }

  // track
  track(
    event_name: string,
    props: object = {},
    options: object = {},
    callback: () => void = utils.noop
  ) {
    if (utils.isUndefined(event_name)) {
      console.log("event_name 不能为空");
      return;
    }

    const properties = Object.assign(
      {
        user: this.user,
        $referrer: document.referrer,
        $current_url: window.location.href
      },
      base_properties,
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

  HTTPBuildQuery(formData: object, arg_separator: string = "&") {
    const tmp_arr: string[] = [];

    // @ts-ignore
    Object.entries(([key, value]) => {
      tmp_arr.push(
        `${encodeURIComponent(key)}=${encodeURIComponent(value.toString())}`
      );
    });
    return tmp_arr.join(arg_separator);
  }

  send_request(
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
  image_request(
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
    image.src = `${url}?${this.HTTPBuildQuery(data)}`;
  }

  // ajax
  ajax_request(
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
  getConfig(key: string): any {
    const value: boolean | string[] | string | number = this.config[key];
    if (utils.isUndefined(value)) {
      return null;
    }
    return value;
  }

  // track-pageview
  track_pageview(page: string = document.location.href) {
    this.track("ph_page_view", { page });
  }
}

export default Track;
