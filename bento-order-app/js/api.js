(function () {
  "use strict";

  const { state } = window.BentoState;

  const JSONP_TIMEOUT_MS = 30000;
  const STATUS_CODES = ["ACTIVE", "CHANGED", "CANCELED", "REJECTED"];
  let requestSequence = 0;

  function getApiBaseUrl() {
    const config = window.APP_CONFIG || {};
    const apiBaseUrl = String(config.API_BASE_URL || "").trim();

    if (!apiBaseUrl) {
      throw new Error("APP_CONFIG.API_BASE_URL is not configured.");
    }

    return apiBaseUrl;
  }

  function buildJsonpUrl(action, payload, callbackName) {
    const params = new URLSearchParams();
    params.set("action", action);
    params.set("callback", callbackName);
    params.set("_", String(Date.now()));

    if (payload !== undefined) {
      params.set("payload", JSON.stringify(payload));
    }

    const apiBaseUrl = getApiBaseUrl();
    const separator = apiBaseUrl.includes("?") ? "&" : "?";
    return `${apiBaseUrl}${separator}${params.toString()}`;
  }

  function cleanupJsonpRequest(script, callbackName, timeoutId) {
    window.clearTimeout(timeoutId);

    if (script.parentNode) {
      script.parentNode.removeChild(script);
    }

    try {
      delete window[callbackName];
    } catch (error) {
      window[callbackName] = undefined;
    }
  }

  function unwrapApiResponse(response) {
    if (!response || response.ok !== true) {
      const message =
        response && response.error
          ? String(response.error)
          : "GAS API returned an invalid response.";
      throw new Error(message);
    }

    return response.data;
  }

  function callGasApi(action, payload) {
    return new Promise((resolve, reject) => {
      const callbackName = `BentoApiJsonp_${Date.now()}_${requestSequence += 1}`;
      const script = document.createElement("script");
      let settled = false;
      let timeoutId;

      function settle(callback) {
        if (settled) return;
        settled = true;
        cleanupJsonpRequest(script, callbackName, timeoutId);
        callback();
      }

      window[callbackName] = (response) => {
        settle(() => {
          try {
            resolve(unwrapApiResponse(response));
          } catch (error) {
            reject(error);
          }
        });
      };

      script.async = true;
      script.src = buildJsonpUrl(action, payload, callbackName);
      script.onerror = () => {
        settle(() => reject(new Error("Failed to load GAS API JSONP response.")));
      };

      timeoutId = window.setTimeout(() => {
        settle(() => reject(new Error("GAS API request timed out.")));
      }, JSONP_TIMEOUT_MS);

      document.head.appendChild(script);
    });
  }

  function normalizeSummaries(summaries) {
    const source = summaries || {};

    return {
      byDepartment: Array.isArray(source.byDepartment)
        ? source.byDepartment
        : Array.isArray(source.department)
          ? source.department
          : [],
      byMenu: Array.isArray(source.byMenu)
        ? source.byMenu
        : Array.isArray(source.total)
          ? source.total
          : []
    };
  }

  function normalizeStatus(status) {
    const value = String(status || "").trim();
    if (STATUS_CODES.includes(value)) return value;

    const statusLabel =
      window.BentoFormatters && typeof window.BentoFormatters.statusLabel === "function"
        ? window.BentoFormatters.statusLabel
        : null;
    const matchedStatus = statusLabel
      ? STATUS_CODES.find((statusCode) => statusLabel(statusCode) === value)
      : "";

    return matchedStatus || value || "UNKNOWN";
  }

  function normalizeOrders(orders) {
    if (!Array.isArray(orders)) return [];

    return orders.map((order) => ({
      ...order,
      status: normalizeStatus(order && order.status)
    }));
  }

  function normalizeInitialData(data) {
    const source = data || {};

    return {
      menus: Array.isArray(source.menus) ? source.menus : state.menus,
      deliveryDates: Array.isArray(source.deliveryDates)
        ? source.deliveryDates
        : state.deliveryDates,
      departments: Array.isArray(source.departments) ? source.departments : state.departments,
      orders: normalizeOrders(source.orders),
      summaries: normalizeSummaries(source.summaries)
    };
  }

  function fetchInitialData() {
    return callGasApi("initial").then(normalizeInitialData);
  }

  function submitOrder(orderPayload) {
    return callGasApi("order", orderPayload);
  }

  function submitChange(changePayload) {
    return callGasApi("change", changePayload);
  }

  function submitCancel(cancelPayload) {
    return callGasApi("cancel", cancelPayload);
  }

  function fetchOrders() {
    return callGasApi("orders").then(normalizeOrders);
  }

  function fetchSummaries() {
    return callGasApi("summaries").then(normalizeSummaries);
  }

  window.BentoApi = {
    fetchInitialData,
    submitOrder,
    submitChange,
    submitCancel,
    fetchOrders,
    fetchSummaries
  };
})();
