

# 埋点

* 收集的数据
  * [x] 设备信息

    浏览器、操作系统、屏幕信息、是否wifi

  * [x] 登录用户

    用户ID、用户名...

  * [ ] cookie

  * [x] 当前页面信息

    当前页面的`url`、`query`、`referrer`、``

  * [x] 触发DOM元素的信息

    tagName、class、id、内容、当前`DOM`到`body` 的`dom`树。 

  * [x] 搜索引擎、关键字

  * [x] 来源网站

  * [x] 

* 内置`track`事件
  - [x] $pageview
  - [ ] $pageleave
  - [ ] $input_time
  
* 不会收集数据情况

  * [x] `DOM`元素过滤	（可自定义配置）

    默认对`html`、`body`不会触发收集

  * [x] 属性过滤(`DOM`属性和其他自定义属性)（可自定义配置）

    默认对无障碍属性过滤收集

  * [x] `DOM`事件 

    * `click`:  除配置了`DOM`元素过滤的以外所有元素。
    * `change`:  `type`值非`submit`和`button`以外的所有`input`，`textarea`、`select`。
    * `submit`: `form`

  * [x] `class`属性包含`ph-no-track`的`DOM`元素的

* 自动埋点

  - [x] 开启可配置

* 对埋点数据的过滤

  - [x] 敏感数据

    信用卡信息、密码、社保账号、身份证信息、手机号...

* 性能方面的埋点
  - [ ] 页面加载各个阶段耗时
  - [ ] 每个`http`请求耗时
* 问题
  * 路由切换收集放在哪里做
  * `userAgent` 分析在客户端还是服务端
  * 设备信息需要哪些
