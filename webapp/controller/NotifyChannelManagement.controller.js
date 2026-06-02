sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/m/Dialog",
    "sap/m/Button",
    "sap/m/Label",
    "sap/m/Input",
    "sap/m/TextArea",
    "sap/m/Select",
    "sap/ui/core/Item",
    "sap/ui/layout/form/SimpleForm",
    "sap/ui/model/json/JSONModel",
    "myapp/model/apiClient"
], function (Controller, MessageToast, MessageBox, Dialog, Button, Label, Input,
             TextArea, Select, Item, SimpleForm, JSONModel, apiClient) {
    "use strict";

    var _h = { "Content-Type": "application/json" };
    var api = {
        get:   function (u)    { return apiClient.request(u); },
        post:  function (u, b) { return apiClient.request(u, { method: "POST",   headers: _h, body: JSON.stringify(b) }); },
        patch: function (u, b) { return apiClient.request(u, { method: "PATCH",  headers: _h, body: JSON.stringify(b) }); },
        del:   function (u)    { return apiClient.request(u, { method: "DELETE" }); }
    };

    var CONFIG_TEMPLATES = {
        EMAIL: '{"smtp":{"host":"smtp.example.com","port":465,"secure":true,"user":"sender@example.com","pass":"password","from":"Message Center <sender@example.com>"},"defaultRecipients":["receiver1@example.com","receiver2@example.com"]}',
        DINGTALK: '{"webhook":"https://oapi.dingtalk.com/robot/send?access_token=YOUR_TOKEN","secret":"SECxxx"}',
        WECOM: '{"webhook":"https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=YOUR_KEY"}'
    };

    return Controller.extend("myapp.controller.NotifyChannelManagement", {

        _t: function (sKey, aArgs) {
            return this.getOwnerComponent().getModel("i18n").getResourceBundle().getText(sKey, aArgs);
        },

        formatChannelStatusText: function (sStatus) {
            return sStatus === "ACTIVE" ? this._t("ncStatusActive") : this._t("ncStatusInactive");
        },

        formatChannelStatusState: function (sStatus) {
            return sStatus === "ACTIVE" ? "Success" : "Error";
        },

        onInit: function () {
            this.getView().setModel(new JSONModel({ channels: [] }), "notify");
            this._loadChannels();
        },

        onNavBack: function () {
            this.getOwnerComponent().getRouter().navTo("RouteHome");
        },

        _loadChannels: function () {
            var that = this;
            api.get("/api/notify/channels").then(function (data) {
                that.getView().getModel("notify").setProperty("/channels", Array.isArray(data) ? data : []);
            }).catch(function (e) { MessageToast.show(e.message); });
        },

        onAddChannel: function () { this._openChannelDialog(null); },
        onEditChannel: function (oEvent) { this._openChannelDialog(oEvent.getSource().data("context")); },

        _openChannelDialog: function (oCh) {
            var that = this;
            var bEdit = !!oCh;
            var oData = oCh ? Object.assign({}, oCh) : { type: "DINGTALK", configJson: CONFIG_TEMPLATES.DINGTALK };

            if (!oData.configJson) {
                oData.configJson = CONFIG_TEMPLATES[oData.type] || "{}";
            }

            var oEmailCfg = this._parseEmailConfig(oData.configJson);
            oData.smtpHost = oEmailCfg.smtpHost;
            oData.smtpPort = oEmailCfg.smtpPort;
            oData.smtpSecure = oEmailCfg.smtpSecure;
            oData.smtpUser = oEmailCfg.smtpUser;
            oData.smtpPass = oEmailCfg.smtpPass;
            oData.smtpFrom = oEmailCfg.smtpFrom;
            oData.defaultRecipients = oEmailCfg.defaultRecipients;

            var oModel = new JSONModel(oData);

            var oTypeSelect = new Select({
                items: ["EMAIL", "DINGTALK", "WECOM"].map(function (t) { return new Item({ key: t, text: t }); }),
                selectedKey: "{/type}",
                change: function (oEv) {
                    var sType = oEv.getSource().getSelectedKey();
                    oModel.setProperty("/type", sType);
                    if (sType === "EMAIL") {
                        if (!oModel.getProperty("/smtpHost")) {
                            var oDefault = that._parseEmailConfig(CONFIG_TEMPLATES.EMAIL);
                            oModel.setProperty("/smtpHost", oDefault.smtpHost);
                            oModel.setProperty("/smtpPort", oDefault.smtpPort);
                            oModel.setProperty("/smtpSecure", oDefault.smtpSecure);
                            oModel.setProperty("/smtpUser", oDefault.smtpUser);
                            oModel.setProperty("/smtpPass", oDefault.smtpPass);
                            oModel.setProperty("/smtpFrom", oDefault.smtpFrom);
                            oModel.setProperty("/defaultRecipients", oDefault.defaultRecipients);
                        }
                    } else {
                        oModel.setProperty("/configJson", CONFIG_TEMPLATES[sType] || "{}");
                    }
                }
            });
            oTypeSelect.setModel(oModel);

            var oSecureSelect = new Select({
                visible: "{= ${/type} === 'EMAIL' }",
                items: [
                    new Item({ key: "true", text: this._t("ncOptionYes") }),
                    new Item({ key: "false", text: this._t("ncOptionNo") })
                ],
                change: function (oEv) {
                    oModel.setProperty("/smtpSecure", oEv.getSource().getSelectedKey() === "true");
                }
            });
            oSecureSelect.setModel(oModel);
            oSecureSelect.setSelectedKey(oData.smtpSecure === false ? "false" : "true");

            var oConfigArea = new TextArea({
                value: "{/configJson}",
                rows: 8,
                width: "100%",
                placeholder: this._t("ncJsonConfigPlaceholder"),
                visible: "{= ${/type} !== 'EMAIL' }"
            });
            oConfigArea.setModel(oModel);

            var oForm = new SimpleForm({ editable: true, layout: "ResponsiveGridLayout", content: [
                new Label({ text: this._t("ncFieldName"), required: true }), new Input({ value: "{/name}" }),
                new Label({ text: this._t("ncFieldType"), required: true }), oTypeSelect,
                new Label({ text: this._t("ncFieldSmtpHost"), required: true, visible: "{= ${/type} === 'EMAIL' }" }), new Input({ value: "{/smtpHost}", visible: "{= ${/type} === 'EMAIL' }" }),
                new Label({ text: this._t("ncFieldSmtpPort"), required: true, visible: "{= ${/type} === 'EMAIL' }" }), new Input({ value: "{/smtpPort}", type: "Number", visible: "{= ${/type} === 'EMAIL' }" }),
                new Label({ text: this._t("ncFieldSmtpUser"), required: true, visible: "{= ${/type} === 'EMAIL' }" }), new Input({ value: "{/smtpUser}", type: "Email", visible: "{= ${/type} === 'EMAIL' }" }),
                new Label({ text: this._t("ncFieldSmtpPass"), required: true, visible: "{= ${/type} === 'EMAIL' }" }), new Input({ value: "{/smtpPass}", type: "Password", visible: "{= ${/type} === 'EMAIL' }" }),
                new Label({ text: this._t("ncFieldSender"), required: true, visible: "{= ${/type} === 'EMAIL' }" }), new Input({ value: "{/smtpFrom}", visible: "{= ${/type} === 'EMAIL' }", placeholder: this._t("ncSenderPlaceholder") }),
                new Label({ text: this._t("ncFieldRecipients"), required: true, visible: "{= ${/type} === 'EMAIL' }" }), new Input({ value: "{/defaultRecipients}", visible: "{= ${/type} === 'EMAIL' }", placeholder: this._t("ncRecipientsPlaceholder") }),
                new Label({ text: this._t("ncFieldSsl"), visible: "{= ${/type} === 'EMAIL' }" }), oSecureSelect,
                new Label({ text: this._t("ncFieldJsonConfig"), required: true, visible: "{= ${/type} !== 'EMAIL' }" }), oConfigArea,
                new Label({ text: this._t("ncFieldDescription") }), new Input({ value: "{/description}" })
            ]});
            oForm.setModel(oModel);

            var oDialog = new Dialog({
                title: bEdit ? this._t("ncDialogEdit") : this._t("ncDialogNew"),
                contentWidth: "580px",
                content: [oForm],
                beginButton: new Button({ text: this._t("saveButton"), type: "Emphasized", press: function () {
                    var oBody = Object.assign({}, oModel.getData());
                    oBody.type = oTypeSelect.getSelectedKey();

                    if (oBody.type === "EMAIL") {
                        if (!oBody.smtpHost || !oBody.smtpUser || !oBody.smtpPass || !oBody.smtpFrom) {
                            MessageToast.show(that._t("ncEmailConfigRequired"));
                            return;
                        }
                        var aRecipients = that._normalizeRecipients(oBody.defaultRecipients);
                        if (!aRecipients.length) {
                            MessageToast.show(that._t("ncRecipientsRequired"));
                            return;
                        }
                        oBody.configJson = JSON.stringify(that._buildEmailConfig(oBody, aRecipients));
                    } else {
                        oBody.configJson = oConfigArea.getValue();
                    }

                    ["smtpHost", "smtpPort", "smtpSecure", "smtpUser", "smtpPass", "smtpFrom", "defaultRecipients"].forEach(function (k) {
                        delete oBody[k];
                    });

                    var oReq = bEdit ? api.patch("/api/notify/channels/" + oCh.id, oBody) : api.post("/api/notify/channels", oBody);
                    oReq.then(function () {
                        MessageToast.show(bEdit ? that._t("ncToastUpdated") : that._t("ncToastCreated"));
                        oDialog.close();
                        that._loadChannels();
                    }).catch(function (e) { MessageBox.error(e.message); });
                }}),
                endButton: new Button({ text: this._t("cancelButton"), press: function () { oDialog.close(); } }),
                afterClose: function () { oDialog.destroy(); }
            });
            this.getView().addDependent(oDialog);
            oDialog.open();
        },

        _parseEmailConfig: function (sConfigJson) {
            try {
                var oCfg = JSON.parse(sConfigJson || "{}");
                var aRecipients = [];
                if (Array.isArray(oCfg.defaultRecipients)) {
                    aRecipients = oCfg.defaultRecipients;
                } else if (typeof oCfg.defaultRecipients === "string") {
                    aRecipients = this._normalizeRecipients(oCfg.defaultRecipients);
                }

                return {
                    smtpHost: oCfg.smtp && oCfg.smtp.host ? oCfg.smtp.host : "smtp.example.com",
                    smtpPort: oCfg.smtp && oCfg.smtp.port ? Number(oCfg.smtp.port) : 465,
                    smtpSecure: oCfg.smtp && oCfg.smtp.secure === false ? false : true,
                    smtpUser: oCfg.smtp && oCfg.smtp.user ? oCfg.smtp.user : "",
                    smtpPass: oCfg.smtp && oCfg.smtp.pass ? oCfg.smtp.pass : "",
                    smtpFrom: oCfg.smtp && oCfg.smtp.from ? oCfg.smtp.from : "",
                    defaultRecipients: aRecipients.join(",")
                };
            } catch (e) {
                return {
                    smtpHost: "smtp.example.com",
                    smtpPort: 465,
                    smtpSecure: true,
                    smtpUser: "",
                    smtpPass: "",
                    smtpFrom: "",
                    defaultRecipients: ""
                };
            }
        },

        _normalizeRecipients: function (sRecipients) {
            return String(sRecipients || "")
                .split(",")
                .map(function (s) { return s.trim(); })
                .filter(Boolean);
        },

        _buildEmailConfig: function (oBody, aRecipients) {
            return {
                smtp: {
                    host: oBody.smtpHost,
                    port: Number(oBody.smtpPort || 465),
                    secure: oBody.smtpSecure !== false,
                    user: oBody.smtpUser,
                    pass: oBody.smtpPass,
                    from: oBody.smtpFrom
                },
                defaultRecipients: aRecipients
            };
        },

        onDeleteChannel: function (oEvent) {
            var that = this;
            var oCh = oEvent.getSource().data("context");
            MessageBox.confirm(this._t("ncDeleteConfirm", [oCh.name]), {
                onClose: function (sAction) {
                    if (sAction !== "OK") return;
                    api.del("/api/notify/channels/" + oCh.id)
                        .then(function () { MessageToast.show(that._t("ncToastDeleted")); that._loadChannels(); })
                        .catch(function (e) { MessageBox.error(e.message); });
                }
            });
        },

        onTestChannel: function (oEvent) {
            var that = this;
            var oCh = oEvent.getSource().data("context");
            MessageToast.show(this._t("ncTestingToast"));
            api.post("/api/notify/channels/" + oCh.id + "/test", {}).then(function (res) {
                MessageBox.show(res.message, {
                    icon: res.success ? MessageBox.Icon.SUCCESS : MessageBox.Icon.ERROR,
                    title: that._t("ncTestResultTitle")
                });
            }).catch(function (e) { MessageBox.error(e.message); });
        }
    });
});
