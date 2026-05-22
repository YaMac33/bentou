/*
 * 設定ファイルのサンプルです。
 * 本番接続時はこのファイルを js/config.js にコピーし、
 * index.html の読み込み先を config.js に変更して利用する想定です。
 */
const APP_CONFIG = {
  API_BASE_URL: "https://script.google.com/macros/library/d/1zFxPAv7R8Esg9s8GJFPYZmgdkQhJcs-q2sYezW3K0I7CnDAU0LY8a8kh/2",
  USE_MOCK_API: true
};

window.APP_CONFIG = APP_CONFIG;
