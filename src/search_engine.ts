const queryString = require("query-string");
const engines = ["google", "baidu", "so", "sogou", "bing"];

interface Params {
  google: string;
  baidu: string;
  sogou: string;
  so: string;
  [key: string]: any;
}

const search_engine = {
  // 获取通过什么搜索引擎搜索到的
  get_search_engine(referrer: string) {
    let engine: string = "";

    engines.forEach(item => {
      if (referrer.search(`https?://(.*)"${item}.com`) === 0) {
        engine = item;
      } else if (referrer.search(`https?://(.*)google.([^/?]*)`) === 0) {
        engine = "google";
      }
    });

    return engine;
  },

  // 获取通过搜索引擎的哪一个关键字搜索的
  get_search_keyword(referrer: string) {
    const engine = search_engine.get_search_engine(referrer);
    const engine_params: Params = {
      google: "q",
      baidu: "wd",
      sogou: "query",
      so: "q"
    };
    const filed: string = engine_params[engine];
    const result = queryString.parseUrl(referrer);
    let keyword: string = "";
    if (filed) {
      keyword = result.query[filed];
    }
    return keyword;
  }
};

export default search_engine;
