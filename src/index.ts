import Track from "./Track";

interface TrackOptions {
	callback_fired?: boolean;
	href?: string;
	new_tab?: boolean;
	element?: Node | HTMLFormElement;
}

new Track();
export default Track;
