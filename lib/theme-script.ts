export const THEME_KEY = "gero-theme";
export const SIDEBAR_KEY = "gero-sidebar";

// Runs in <head> before first paint: resolves the saved theme choice (the device setting when
// there is none) to data-theme="dark|light", and restores a collapsed sidebar, so neither flashes.
export const THEME_SCRIPT = `(function(){try{var d=document.documentElement;var c=localStorage.getItem("${THEME_KEY}");var t=c==="light"||c==="dark"?c:(matchMedia("(prefers-color-scheme: light)").matches?"light":"dark");d.setAttribute("data-theme",t);if(localStorage.getItem("${SIDEBAR_KEY}")==="collapsed")d.setAttribute("data-sidebar","collapsed")}catch(e){}})()`;
