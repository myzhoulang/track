import utils from "./utils";

interface Track {
  track: (
    event_name: string,
    props: object,
    options: object,
    callback: () => void
  ) => void;
}

interface Props {
  [key: string]: any;
}

const auto_track = {
  init(instance: Track) {
    this.ph = instance;
    this.addDomEventHandler(instance);
  },

  addDomEventHandler(instance: Track) {
    const handler = this.track_event.bind(this, instance);
    utils.addEvent(document, "click", handler);
    utils.addEvent(document, "submit", handler);
    utils.addEvent(document, "change", handler);

  },

  shouldTrackDomEvent(el: Element, event: Event): boolean {
    const tag = el.tagName.toLowerCase();
    const type = event.type;
    switch (tag) {
      case "form":
        return type === "submit";

      case "input":
        const inputType = el.getAttribute("type");
        if (["button", "submit"].indexOf(inputType) === -1) {
          return type === "change";
        } else {
          return type === "click";
        }

      case "select":
      case "textarea":
        return type === "change";

      default:
        return type === "click";
    }
  },

  shouldTrackDomNode(el: Element): boolean {
    const elements_blacklist = this.ph.getConfig("track_elements_blacklist");

    const isNotTrack =
      !el ||
      utils.isTag(el, "html") ||
      !utils.isElement(el) ||
      elements_blacklist.indexOf(el.tagName.toLowerCase()) !== -1;

    return !isNotTrack;
  },

  shouldTrackValue(value: any): boolean {
    const filter_sensitive_data = this.ph.getConfig("filter_sensitive_data");
    // 值为null、undefined 或者开启不过滤值属性
    if (value === null || utils.isUndefined(value) || !filter_sensitive_data) {
      return false;
    }

    if (utils.isString(value)) {
      // 社会信用代码、银行卡号、身份证
      const ssnRegexp = /^[0-9A-HJ-NPQRTUWXY]{2}\d{6}[0-9A-HJ-NPQRTUWXY]{10}$/;
      const ccRegexp = /^[1-9]\d{9,29}$/;
      const idRegexp = /(^\d{8}(0\d|10|11|12)([0-2]\d|30|31)\d{3}$)|(^\d{6}(18|19|20)\d{2}(0\d|10|11|12)([0-2]\d|30|31)\d{3}(\d|X|x)$)/;

      value = value.trim();
      const isNotTrack =
        ccRegexp.test(value.replace(/[- ]/g, "")) ||
        idRegexp.test(value) ||
        ssnRegexp.test(value);

      return !isNotTrack;
    }
  },

  track_event(
    instance: Track,
    event: MouseEvent | KeyboardEvent,
    callback: () => void = utils.noop
  ) {
    let target: Element = event.target as Element;
    let target_tagname = target.tagName.toLowerCase();
    let target_type = target.getAttribute("type");
    // 判断是否已经触发过回调
    let callback_fired: boolean = false;
    const urlRegexp = /^(((ht|f)tps?):\/\/)?[\w-]+(\.[\w-]+)+([\w.,@?^=%&:\/~+#-]*[\w@?^=%&\/~+#-])?$/;

    // track 回调
    function track_after(href: string) {
      if (callback_fired || !urlRegexp.test(href)) {
        return;
      }
      callback_fired = true;
      window.location.href = href;
    }

    if (utils.isTextNode(target)) {
      target = target.parentNode as Element;
    }

    if (
      this.shouldTrackDomEvent(target, event) &&
      this.shouldTrackDomNode(target)
    ) {
      const targetList: Element[] = [target];
      let current = target;
      let elements: Props[] = [];
      let href: string;
      let explicitNoTrack = false;

      // 记录当前元素到BODY的元素路径
      while (current.parentNode && !utils.isTag(current, "body")) {
        targetList.push(current.parentNode as Element);
        current = current.parentNode as Element;
      }


      targetList.forEach(element => {
        if (utils.isTag(element, "a")) {
          // 是否是新窗口打开
          const new_tab =
            event.which === 2 ||
            event.metaKey ||
            event.ctrlKey ||
            element.getAttribute("target") === "blank";
          href = element.getAttribute("href");

          if (urlRegexp.test(href) && !new_tab) {
            event.preventDefault();
            setTimeout(track_after, 300);
          }
        }

        if (utils.hasClassName(element, "ph-no-track")) {
          explicitNoTrack = true;
        }

        elements.push(this.getPropsFromElement(element));
      });

      if (explicitNoTrack) {
        return false;
      }

      let elementText: string;
      let safeElementText: string = this.getSafeText(target);
      let value;

      if (safeElementText && safeElementText.length > 0) {
        elementText = safeElementText;
      }

      // 获取表单控件的数据
      if (
        ((target_tagname === "input" &&
          ["button", "submit", "password"].indexOf(target_type) === -1) ||
          ["textarea", "select"].indexOf(target_tagname) !== -1) &&
        event.type === "change"
      ) {
        value = (<HTMLInputElement>target).value;
      }

      instance.track(
        "$web_event",
        {
          $elements: elements,
          $el_href: href,
          $el_value: value,
          $el_text: elementText
        },
        {},
        () => {
          track_after(href);
          callback();
        }
      );
    }
  },

  getSafeText(el: Element) {
    let el_text = "";
    const childNodes = el.childNodes;
    if (childNodes && childNodes.length > 0) {
      childNodes.forEach(item => {
        const textContent: string = item.textContent;
        if (utils.isTextNode(item as Element) && textContent) {
          const text = textContent
            .trim()
            .split(/(\s+)/)
            .filter(this.shouldTrackValue.bind(this))
            .join("")
            .replace(/[\r\n]/g, " ")
            .replace(/[ ]+/g, " ")
            .substring(0, 255);

          el_text += text;
        }
      });
    }
  },

  // 从元素上获取 attr
  getPropsFromElement(el: Element): Props {
    if (!utils.isElement(el)) return;
    const tag_name = el.tagName.toLowerCase();

    const props: Props = {
      classNames: utils.getClassNames(el),
      id: el.getAttribute("id"),
      tag_name: tag_name,
      el_text: this.getSafeText(el)
    };
    if (utils.isTag(el, "body")) {
      return props;
    }

    const attr_names: any[] = el.getAttributeNames();
    attr_names.forEach(attr_name => {
      const no_track_rule = this.ph.getConfig("track_property_blacklist");

      // 排除无障碍属性
      if (
        /^aria-.*/.test(attr_name) ||
        ["role", "tabindex", "class", "id"].indexOf(attr_name) !== -1
      ) {
        return;
      }
      // 数组规则过滤
      if (Array.isArray(no_track_rule) && no_track_rule.indexOf(name) !== -1) {
        return;
      }
      // 正则匹配过滤
      if (utils.isRegx(no_track_rule) && no_track_rule.test(name)) {
        return;
      }

      props[`${attr_name}`] = el.getAttribute(attr_name);
    });

    // 定位元素dom树中的位置
    let nth_child = 1;
    let nth_of_type = 1;
    let current = el;

    while ((current = this.prev(current))) {
      nth_child++;
      if (current.tagName === el.tagName) {
        nth_of_type++;
      }
    }

    props.nth_child = nth_child;
    props.nth_of_type = nth_of_type;
    return utils.strip_empty_properties(props);
  },

  prev(el: Element | Node) {
    const prev = (el as Element).previousElementSibling;
    if (prev) {
      return prev;
    } else {
      do {
        el = el.previousSibling;
      } while (el && utils.isElement(el));

      if (utils.isElement(el)) {
        return el;
      }

      return null;
    }
  }
};

export default auto_track;
