sap.ui.define([], function () {
    "use strict";

    var fnTokenProvider = function () { return ""; };
    var fnTokenUpdater = function () {};
    var fnUnauthorized = function () {};
    var oRefreshPromise = null;

    function parseJsonSafe(oResponse) {
        return oResponse.text().then(function (sText) {
            if (!sText) {
                return null;
            }
            try {
                return JSON.parse(sText);
            } catch (e) {
                return { message: sText };
            }
        });
    }

    function normalizeSuccessPayload(oPayload) {
        if (!oPayload || typeof oPayload !== "object") {
            return oPayload;
        }
        if (Object.prototype.hasOwnProperty.call(oPayload, "success")) {
            if (oPayload.success === false) {
                var oErr = new Error(oPayload.message || "请求失败");
                oErr.payload = oPayload;
                throw oErr;
            }
            return Object.prototype.hasOwnProperty.call(oPayload, "data") ? oPayload.data : oPayload;
        }
        return oPayload;
    }

    function normalizeError(oResponse, oPayload) {
        var sMessage = "请求失败";

        if (oPayload && typeof oPayload === "object") {
            if (Array.isArray(oPayload.message)) {
                sMessage = oPayload.message.join("；");
            } else if (oPayload.message) {
                sMessage = oPayload.message;
            } else if (oPayload.error) {
                sMessage = oPayload.error;
            }
        } else if (typeof oPayload === "string" && oPayload) {
            sMessage = oPayload;
        }

        var oError = new Error(sMessage);
        oError.status = oResponse.status;
        oError.payload = oPayload;
        return oError;
    }

    function refreshToken() {
        if (oRefreshPromise) {
            return oRefreshPromise;
        }

        var sToken = fnTokenProvider();
        if (!sToken) {
            return Promise.resolve(false);
        }

        oRefreshPromise = fetch("/api/auth/refresh", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + sToken
            },
            body: JSON.stringify({})
        })
            .then(function (oResponse) {
                return parseJsonSafe(oResponse).then(function (oPayload) {
                    if (!oResponse.ok) {
                        throw normalizeError(oResponse, oPayload);
                    }
                    return normalizeSuccessPayload(oPayload) || {};
                });
            })
            .then(function (oData) {
                var sNewToken = oData.accessToken || oData.token || "";
                if (!sNewToken) {
                    return false;
                }
                fnTokenUpdater(sNewToken, oData.user || null);
                return true;
            })
            .catch(function () {
                return false;
            })
            .finally(function () {
                oRefreshPromise = null;
            });

        return oRefreshPromise;
    }

    function request(sUrl, mOptions) {
        var oOptions = Object.assign({}, mOptions || {});
        var bSkipAuth = !!oOptions.skipAuth;
        var bRetryAfterRefresh = oOptions.retryAfterRefresh !== false;
        delete oOptions.skipAuth;
        delete oOptions.retryAfterRefresh;

        var oHeaders = Object.assign({}, oOptions.headers || {});
        var sToken = fnTokenProvider();

        if (!bSkipAuth && sToken) {
            oHeaders.Authorization = "Bearer " + sToken;
        }

        oOptions.headers = oHeaders;

        return fetch(sUrl, oOptions)
            .then(function (oResponse) {
                if (oResponse.status === 401 && !bSkipAuth && bRetryAfterRefresh) {
                    return refreshToken().then(function (bRefreshed) {
                        if (!bRefreshed) {
                            fnUnauthorized();
                            throw normalizeError(oResponse, { message: "登录已过期，请重新登录" });
                        }
                        return request(sUrl, Object.assign({}, mOptions || {}, { retryAfterRefresh: false }));
                    });
                }

                return parseJsonSafe(oResponse).then(function (oPayload) {
                    if (!oResponse.ok) {
                        throw normalizeError(oResponse, oPayload);
                    }
                    return normalizeSuccessPayload(oPayload);
                });
            })
            .catch(function (oError) {
                if (oError && oError.status) {
                    throw oError;
                }
                var oWrapped = new Error(oError && oError.message ? oError.message : "网络异常，请稍后重试");
                oWrapped.status = 0;
                throw oWrapped;
            });
    }

    return {
        configure: function (mHandlers) {
            fnTokenProvider = (mHandlers && mHandlers.tokenProvider) || fnTokenProvider;
            fnTokenUpdater = (mHandlers && mHandlers.tokenUpdater) || fnTokenUpdater;
            fnUnauthorized = (mHandlers && mHandlers.onUnauthorized) || fnUnauthorized;
        },
        request: request,
        refreshToken: refreshToken,
        getErrorMessage: function (oError, sFallback) {
            if (oError && oError.message) {
                return oError.message;
            }
            return sFallback || "请求失败";
        }
    };
});
