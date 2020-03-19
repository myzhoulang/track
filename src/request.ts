import store from "./Store";
import { STORE_KEY, BATCH_SEND_DEFAULT_OPTIONS } from "./const";

const querystring = require("query-string");
import utils from "./utils";

export interface SendOptions {
  timeout?: number;
}

export interface TrackResponse {
  status: number;
  message?: string;
  data?: object;
}

interface BatchSendConfig {
  max_length?: number;
  timeout?: number;
  interval?: number;
}

// Image 请求方式上报数据
export function image_request(
  url: string,
  data: object,
  options: SendOptions,
  callback: (res: TrackResponse) => void = utils.noop
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

// AJAX 请求方式上报数据
export function ajax_request(
  url: string,
  data: object,
  options: SendOptions,
  callback: (res: TrackResponse) => void = utils.noop
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
          const data = JSON.parse(req.responseText);
          callback({ status: req.status, data });
        } catch (e) {
          console.error(e);
        }
      } else {
        console.error(`上报失败: data = ${JSON.stringify(data)}`);
        callback({ status: req.status, message: `ajax: ${url}请求失败` });
      }
    }
  };
  if (!Array.isArray(data)) {
    data = [data];
  }
  req.send(JSON.stringify(data));
}

export function send_request(
  data: object,
  options: SendOptions,
  callback: (res?: TrackResponse) => void = utils.noop
) {
  // 当前无网络状态下直接将上报数据保存到localStorage
  if (!utils.isOnline) {
    store.arrayAppend(STORE_KEY, data);
    return;
  }

  const _callback: (res: TrackResponse) => void = (res: TrackResponse) => {
    callback(res);
  };

  const url = this.getConfig("api_host");
  const request_type = this.getConfig("request_type");

  switch (request_type) {
    case "image":
      image_request(url, data, options, _callback);
      break;

    case "XHR":
      ajax_request(url, data, options, _callback);
      break;
  }
}

// 在页面 unload  或者 刷新的时候
// 使用该方法发送数据
export function send_store(e: Event) {
  console.log("send_store");
  const url = this.getConfig("api_host");
  const data = store.get(STORE_KEY);
  if (data.length < 1) {
    return;
  }

  beacon(url, data);
}

export function beacon(url: string, data: object, callback?: () => void) {
  if (typeof navigator.sendBeacon === "function") {
    // 判断是否进入队列
    // 进入队列就默认发送成功
    // 清空数据
    const blob = new Blob([JSON.stringify(data)], {
      type: "application/x-www-form-urlencoded"
    });

    navigator.sendBeacon(url, blob) && store.set(STORE_KEY, []);
  } else {
    ajax_request(url, data, {}, callback);
  }
}

// 批量发送事件
export function seed_batch() {
  const batchConfig: BatchSendConfig | boolean = this.getConfig("batch_send");
  const config: BatchSendConfig = utils.isBoolean(batchConfig)
    ? BATCH_SEND_DEFAULT_OPTIONS
    : (batchConfig as BatchSendConfig);

  function send() {
    const data = store.get(STORE_KEY);
    const callback: (res: TrackResponse) => void = (res: TrackResponse) => {
      if (res.status === 200) {
        data.splice(0, config.max_length);
        store.set(STORE_KEY, data);
      }
    };
    if (Array.isArray(data) && data.length > 0) {
      send_request(
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
