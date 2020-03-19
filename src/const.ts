export const STORE_KEY = "$batch_track_data";
export const EVENTS = "$pageview $pageleave $input_time $page_load".split(" ");
export const BATCH_SEND_DEFAULT_OPTIONS = {
	max_length: 10,
	timeout: 5000,
	interval: 10000
};
