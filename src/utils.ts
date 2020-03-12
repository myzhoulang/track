const toString: () => string = Object.prototype.toString;

// svg class 对象
interface svgClassName {
  baseVal: string;
}

const utils = {
  each(
    obj: any[] | object,
    iterator: (
      value: any,
      index: number | string,
      array: any[],
      thisArg?: any
    ) => void,
    context: object
  ) {
    if (Array.isArray(obj)) {
      obj.forEach(iterator, context);
    }

    if (utils.isObject(obj)) {
      Object.keys(obj).forEach(key => {
        // @ts-ignore
        iterator(obj[key], key, obj);
      }, context);
    }
  },
  isFunction(fn: any): boolean {
    return toString.call(fn) === "[object Function]";
  },
  isBoolean(value: boolean): boolean {
    return toString.call(value) === "[object Boolean]";
  },
  isObject(obj: object): boolean {
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
  isElement(el: Node): boolean {
    return el && el.nodeType === 1;
  },
  isTextNode(el: Element): boolean {
    return el.nodeType === 3;
  },
  isTag(el: Element, tagName: string): boolean {
    return el.tagName.toLowerCase() === tagName.toLowerCase();
  },
  addEvent(el: Document, type: string, fn: EventListener) {
    el.addEventListener(type, fn, false);
  },
  removeEvent(el: Element, type: string, fn: EventListener) {
    el.removeEventListener(type, fn, false);
  },
  noop: () => {},

  strip_empty_properties(obj: object) {
    const ret: { [key: string]: any } = {};

    Object.entries(obj).forEach(([key, value]) => {
      if (value === null || value === undefined) {
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
      }

      // 数组处理
      if (Array.isArray(value)) {
        ret[key] = [];
        value.forEach(item => {
          if (Array.isArray(item) || utils.isObject(item)) {
            ret[key].push(utils.strip_empty_properties(item));
          } else {
            ret[key] = value;
          }
        });
      }

      if (utils.isObject(value)) {
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
  }
};

export default utils;
