function rewrite(type: string){
	console.log(type)
	// @ts-ignore
	const oldFn = history[type]
	return function() {
    const rv = oldFn.apply(this, arguments);
    const event = new PopStateEvent("popstate");
    window.dispatchEvent(event);
    return rv;
  };
}

history.pushState = rewrite('pushState');
history.replaceState = rewrite('replaceState');
