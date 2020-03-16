import utils from "./utils";
import Track from "./Track";

interface TrackOptions {
  callback_fired?: boolean;
  href?: string;
  new_tab?: boolean;
  element?: HTMLFormElement;
}

class DomTrack {
  protected override_event: string = "click";
  private ph: Track;

  constructor(instance: Track) {
    this.ph = instance;
  }

  public track(
    querySelector: string | Node,
    event_name: string,
    props: ((element: Node) => object) | object,
    callback?: () => void
  ) {
    let elements: Node[] = [];
    if (utils.isElement(querySelector)) {
      elements.push(querySelector as Node);
    } else {
      elements = Array.prototype.slice.call(
        document.querySelectorAll(querySelector as string)
      );
    }

    if (elements.length < 1) return;

    elements.forEach(el => {
      utils.addEvent(el, this.override_event, (event: Event) => {
        const options: TrackOptions = {
          callback_fired: false
        };
        const timeout = this.ph.getConfig("track_link_timeout");

        this.event_handler(event, el, options);
        this.ph.track(
          event_name,
          props,
          options,
          this.track_callback(props, options, callback)
        );

        // 对于A链接的跳转 和表单提交之后的跳转 需要先阻止默认事件
        // 在发送数据到服务端超过一定时间无响应的直接执行相应跳转
        window.setTimeout(
          this.track_callback(props, options, callback),
          timeout
        );
      });
    });
  }
  protected event_handler(event: Event, el: Node, options: object) {}

  public track_callback(
    props: object,
    options: TrackOptions,
    user_callback: (props: object) => void
  ) {
    return () => {
      if (options.callback_fired) {
        return;
      }

      options.callback_fired = true;

      if (utils.isFunction(user_callback)) {
        user_callback(props);
      }

      // 执行track_after
      this.after_track_handler(props, options);
    };
  }

  public after_track_handler(props: object, options: TrackOptions) {}
}

class LinkTrack extends DomTrack {
  protected override_event: string = "click";
  constructor(instance: Track) {
    super(instance);
  }

  protected event_handler(
    event: MouseEvent | KeyboardEvent,
    el: Element,
    options: TrackOptions
  ) {
    // 是否是新窗口打开
    const new_tab =
      event.which === 2 ||
      event.metaKey ||
      event.ctrlKey ||
      el.getAttribute("target") === "blank";

    options.href = el.getAttribute("href");
    options.new_tab = new_tab;

    // 判断是否是新窗口打开
    // 在非单页面的时候跳转到其他页面会导致AJAX请求会被 cancel
    if (!new_tab) {
      event.preventDefault();
    }
  }

  after_track_handler(props: object, options: TrackOptions) {
    super.after_track_handler(props, options);
    if (options.new_tab) {
      return;
    }

    setTimeout(() => (window.location.href = options.href), 0);
  }
}

class FormTrack extends DomTrack {
  protected override_event: string = "submit";
  constructor(instance: Track) {
    super(instance);
  }

  protected event_handler(
    event: Event,
    el: HTMLFormElement,
    options: TrackOptions
  ) {
    super.event_handler(event, el, options);
    options.element = el;
    event.preventDefault();
  }

  public after_track_handler(props: object, options: TrackOptions) {
    super.after_track_handler(props, options);

    setTimeout(() => options.element.submit(), 0);
  }
}

export { FormTrack, LinkTrack };
