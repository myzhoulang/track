const pkg = require("../package.json");
import { store } from "./store";

// 执行一次之后就不会变得属性.
const base_properties = {
  $user_agent: navigator.userAgent,

  $version: pkg.version,

  $screen_height: screen.height,
  $screen_width: screen.width,
  $insert_id: (function() {
    const insert_id = store.get("$insert_id");
    if (insert_id) {
      return insert_id;
    }
    const _inset_id =
      Math.random()
        .toString(36)
        .substring(2, 10) +
      Math.random()
        .toString(36)
        .substring(2, 10);
    store.set("$insert_id", _inset_id);
    return _inset_id;
  })(),
  $time: Date.now()
};

export default base_properties;
