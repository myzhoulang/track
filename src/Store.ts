import utils from "./utils";
class Store {
  private store: Storage = window.localStorage;

  set(key: string, value: any) {
    let _value: string;
    if (utils.isObject(value) || Array.isArray(value)) {
      _value = JSON.stringify(value);
    } else {
      _value = String(value);
    }

    this.store.setItem(key, _value);
  }

  get(key: string) {
    let value: any = this.store.getItem(key);

    try {
      value = JSON.parse(value);
      return value;
    } catch (e) {
      return value;
    }
  }

  remove(key: string) {
    this.store.removeItem(key);
  }

  clear() {
    this.store.clear();
  }

  arrayAppend(item: string, value: any) {
    let oldValue: any = this.get(item);
    if (utils.isUndefined(oldValue) || oldValue === null) {
      oldValue = [];
    }
    if (!Array.isArray(oldValue)) {
      console.error("操作失败：旧的值不是数组，不符合数组追加");
      return;
    }
    let _value = oldValue.concat(Array.isArray(value) ? value : [value]);
    this.set(item, _value);
    return _value;
  }
}

const store = new Store();
export default store;
