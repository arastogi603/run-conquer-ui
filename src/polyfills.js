// Fix for SockJS in Vite
if (typeof global === "undefined") {
  window.global = window;
}