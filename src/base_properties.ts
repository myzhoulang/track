const pkg = require('../package.json');

// 执行一次之后就不会变得属性.
const base_properties = {
  $user_agent: navigator.userAgent,

  $version: pkg.version,

  $screen_height: screen.height,
  $screen_width: screen.width,
  $insert_id:
    Math.random()
      .toString(36)
      .substring(2, 10) +
    Math.random()
      .toString(36)
      .substring(2, 10),
	$time: Date.now()
};

export default base_properties;
