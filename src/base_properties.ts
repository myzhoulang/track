const pkg = require('../package.json');
const UAParser = require("ua-parser-js");
const parser = new UAParser();
const browser = parser.getBrowser();
const device = parser.getDevice();
const engine = parser.getEngine();
const os = parser.getOS();
const cpu = parser.getCPU();

// 执行一次之后就不会变得属性
// 设备信息、版本号...
const base_properties = {
  $os: os.name,
  $os_version: os.version,
  $engine: engine.name,
  $engine_version: engine.version,
  $device: device.model,
  $device_type: device.type,
  $device_vendor: device.vendor,
  $browser: browser.name,
  $browser_version: browser.version,
  $cpu: cpu.architecture,

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
