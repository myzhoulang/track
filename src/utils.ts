const querystring = require("query-string");
const toString: () => string = Object.prototype.toString;

// svg class 对象
interface svgClassName {
  baseVal: string;
}

const utils = {
  isFunction(fn: any): boolean {
    return toString.call(fn) === "[object Function]";
  },
  isBoolean(value: any): boolean {
    return toString.call(value) === "[object Boolean]";
  },
  isObject(obj: any): boolean {
    return obj === Object(obj) && !Array.isArray(obj);
  },
  isEmptyObject(obj: object): boolean {
    return this.isObject(obj) && Object.keys(obj).length === 0;
  },
  isUndefined(value: any): boolean {
    return value === void 0;
  },
  isString(str: string): boolean {
    return toString.call(str) === "[object String]";
  },
  isNumber(num: number): boolean {
    return toString.call(num) === "[object Number]";
  },
  isRegx(reg: RegExp): boolean {
    return toString.call(reg) === "[object RegExp]";
  },
  isElement(el: any): boolean {
    return el && el.nodeType === 1;
  },
  isTextNode(el: Element): boolean {
    return el.nodeType === 3;
  },
  isTag(el: Element, tagName: string): boolean {
    if (!this.isElement(el)) return;
    return el.tagName.toLowerCase() === tagName.toLowerCase();
  },
  addEvent(el: Node | Window, type: string, fn: EventListener) {
    el.addEventListener(type, fn, false);
  },
  removeEvent(el: Element, type: string, fn: EventListener) {
    el.removeEventListener(type, fn, false);
  },
  noop: () => {},

  strip_empty_properties(obj: object) {
    const ret: { [key: string]: any } = {};

    Object.entries(obj).forEach(([key, value]) => {
      if (value === null || value === undefined || utils.isEmptyObject(value)) {
        return;
      }
      // 基本数据类型
      // 除了空字符串以外直接赋值
      if (
        utils.isNumber(value) ||
        utils.isBoolean(value) ||
        (utils.isString(value) && value.length > 0)
      ) {
        ret[key] = value;
      } else if (Array.isArray(value) && value.length > 0) {
        // 数组处理
        ret[key] = [];
        value.forEach(item => {
          if (Array.isArray(item) || utils.isObject(item)) {
            ret[key].push(utils.strip_empty_properties(item));
          } else {
            ret[key] = value;
          }
        });
      } else if (utils.isObject(value) && !utils.isEmptyObject(value)) {
        // 对象处理
        ret[key] = utils.strip_empty_properties(value);
      }
    });

    return ret;
  },

  getClassNames(el: Element) {
    const classNames: string | svgClassName = el.className;

    switch (typeof classNames) {
      case "string":
        return classNames.split(" ").filter(Boolean);

      // svg 特殊处理
      case "object":
        return (
          (<svgClassName>classNames).baseVal || el.getAttribute("class") || ""
        );

      default:
        return "";
    }
  },

  hasClassName(el: Element, className: string) {
    const classNames = utils.getClassNames(el);
    return classNames.includes(className);
  },

  getQueryParams(url: string = location.href) {
    const result = querystring.parseUrl(url);
    return result.query;
  },

  isOnline: navigator.onLine
};

// 监测网络状态
function updateOnlineStatus() {
  utils.isOnline = navigator.onLine;
}
utils.addEvent(window, "online", updateOnlineStatus);
utils.addEvent(window, "offline", updateOnlineStatus);

export default utils;
