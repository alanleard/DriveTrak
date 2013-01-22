function Controller() {
    function vehicleConnect() {
        vehicleModule.startSearchDevice(deviceSearch);
        $.connectBtn.title = "waiting for vehicle";
    }
    function deviceSearch(device) {
        vehicleModule.stopSearchDevice();
        Ti.API.info(device.id);
        vehicleObject = vehicleModule.createVehicleInterface({
            device: device
        });
        vehicleObject.addEventListener("connectionStatus", connect);
        vehicleObject.connect();
    }
    function connect(e) {
        Ti.API.info("status=" + e.status);
        if (e.status == "connected") {
            $.connectBtn.title = "disconnect";
            $.status.text = "Ready to Track";
            vehicleObject.addEventListener("drivingOperation", didReceiveDrivingOperation);
            $.connectBtn.removeEventListener("click", vehicleConnect);
            $.connectBtn.addEventListener("click", disconnect);
        } else disconnect(e);
    }
    function disconnect(e) {
        if (report != null) {
            var endTime = (new Date).toLocaleString();
            track.trip.end = endTime;
            finalizeReport(endTime);
        }
        $.connectBtn.title = "connect to vehicle";
        $.status.text = "Connect to start tracking";
        if (vehicleObject != null) {
            vehicleObject.removeEventListener("drivingOperation", didReceiveDrivingOperation);
            vehicleObject.disconnect();
            vehicleObject = null;
        }
        $.connectBtn.removeEventListener("click", disconnect);
        $.connectBtn.addEventListener("click", vehicleConnect);
    }
    function didReceiveVehicleBehavior(e) {
        vehicleBehaviorTrack({
            label: $.maxSpeed,
            type: "vehicleSpeed",
            title: "Vehicle Speed",
            data: e.vehicleSpeed
        });
        vehicleBehaviorTrack({
            label: $.maxThrottle,
            type: "throttlePosition",
            title: "Throttle Rate",
            data: e.throttlePosition
        });
        vehicleBehaviorTrack({
            label: $.maxRpm,
            type: "engineSpeed",
            title: "Engine Speed",
            data: e.engineSpeed
        });
        vehicleBehaviorTrack({
            label: $.maxAcceleration,
            type: "accelerationX",
            title: "Acceleration",
            data: e.accelerationX
        });
    }
    function vehicleBehaviorTrack(e) {
        var vData = e.data, settingMax = settings[e.type].max, currentMax = track[e.type].current;
        if (settings[e.type].conversion) {
            vData = conversion[e.type]({
                type: "out",
                value: e.data
            });
            settingMax = conversion[e.type]({
                type: "out",
                value: settings[e.type].max
            });
        }
        if (vData > track[e.type].max || track[e.type].max == 0) {
            track[e.type].max = vData;
            e.label.text = "Max " + e.title + ": " + track[e.type].max + settings[e.type].extension;
        }
        if (vData > settingMax) if (!track[e.type].flag) {
            track[e.type].flag = !0;
            settings[e.type].notify && acs.pushNotify({
                payload: "Drive Track Alert for " + settings.driverName + "\n\n" + e.title + " exceeded limit of " + settingMax + settings[e.type].extension
            });
        } else if (!track[e.type].current || vData > track[e.type].current) track[e.type].current = vData;
        if (vData < settingMax && track[e.type].flag) {
            track[e.type].flag = !1;
            appendReport({
                title: e.title + " Limit Exceeded",
                detail: currentMax + settings[e.type].extension
            });
            track[e.type].current = null;
        }
    }
    function didReceiveDrivingOperation(e) {
        if (e.transmissionRange != 0 && !track.transmission.flag) {
            e.parkingBrakeStatus == 1 && alert("WARNING: Your parking break is still on.");
            getCloud();
            vehicleObject.addEventListener("vehicleBehavior", didReceiveVehicleBehavior);
            track.transmission.flag = !0;
            var startTime = (new Date).toLocaleString();
            track.trip.start = startTime;
            createReport(startTime);
            $.status.text = "Tracking";
            alert("Start Tracking: " + track.trip.start);
        } else if (e.transmissionRange == 0 && track.transmission.flag) {
            vehicleObject.removeEventListener("vehicleBehavior", didReceiveVehicleBehavior);
            track.transmission.flag = !1;
            var endTime = (new Date).toLocaleString();
            track.trip.end = endTime;
            finalizeReport(endTime);
            acs.emailSend({
                message: report,
                recipients: settings.reportEmail,
                name: settings.driverName
            });
            $.status.text = "Stopped Tracking";
            alert("End Tracking: " + track.trip.end);
        }
        track.transmission.status = e.transmissionRange;
    }
    function populateSettings(data) {
        data != null && (settings = data);
        $.driverName.value = settings.driverName;
        $.reportEmail.value = settings.reportEmail;
        $.vehicleSpeedMax.value = conversion.vehicleSpeed({
            type: "out",
            value: settings.vehicleSpeed.max
        }) + settings.vehicleSpeed.extension;
        $.engineSpeedMax.value = settings.engineSpeed.max + settings.engineSpeed.extension;
        $.accelerationXMax.value = conversion.accelerationX({
            type: "out",
            value: settings.accelerationX.max
        }) + settings.accelerationX.extension;
        $.throttlePositionMax.value = settings.throttlePosition.max + settings.throttlePosition.extension;
    }
    function updateSettings(e) {
        e.source.type != "driverName" && e.source.type != "reportEmail" ? e.source.value.length > 0 && (settings[e.source.type].conversion ? settings[e.source.type].max = conversion[e.source.type]({
            type: "in",
            value: e.source.value
        }) : settings[e.source.type].max = e.source.value) : settings[e.source.type] = e.source.value;
    }
    function addExtension(e) {
        e.source.value ? e.source.value += settings[e.source.type].extension : settings[e.source.type].conversion ? e.source.value = conversion[e.source.type]({
            type: "out",
            value: settings[e.source.type].max
        }) + settings[e.source.type].extension : e.source.value = settings[e.source.type].max + settings[e.source.type].extension;
        updateCloud();
    }
    function updateCloud() {
        Ti.App.Properties.hasProperty("pushID") && (Ti.App.Properties.hasProperty("userLink") ? acs.updateUserLink(settings, populateSettings) : acs.createUserLink(settings));
    }
    function getCloud() {
        Ti.App.Properties.hasProperty("userLink") && acs.getUserLink(function(e) {
            populateSettings(e);
        });
    }
    function loggedIn() {
        acs.pushRegister({
            success: acs.pushSubscribe
        });
        getCloud();
    }
    function createReport(startTime) {
        report = "<p><b>Drive Track Driving Report Details for " + settings.driverName + "</b><br><br>Start Time: " + startTime + "</p><p>";
    }
    function appendReport(data) {
        var date = new Date, hour = date.getHours(), minutes = (date.getMinutes() < 10 ? "0" : "") + date.getMinutes(), time = hour + ":" + minutes;
        report += data.title + ": " + data.detail + " (Time: " + time + ")<br>";
    }
    function finalizeReport(endTime) {
        report += "</p><p>End Time: " + endTime + "<br><br>Max Speed: " + track.vehicleSpeed.max + settings.vehicleSpeed.extension + "<br>Max RPMs: " + track.engineSpeed.max + settings.engineSpeed.extension + "<br>Max Acceleration: " + track.accelerationX.max + settings.accelerationX.extension + "<br>Max Throttle: " + track.throttlePosition.max + settings.throttlePosition.extension + "<br></p>";
        track.vehicleSpeed.max = 0;
        track.engineSpeed.max = 0;
        track.accelerationX.max = 0;
        track.throttlePosition.max = 0;
    }
    function displayReference() {
        if (Ti.Network.online == 1) {
            alert("Have driver scan your reference code to activate.");
            setParent();
            if ($.win2.children.length < 3) {
                var qrView = Ti.UI.createImageView({
                    top: 20,
                    image: "http://dev2app.com/qr/?data=" + Ti.App.Properties.getString("userID")
                });
                $.win2.add(qrView);
                qrView.addEventListener("click", closeQR);
            }
        } else alert("You must be online to display your current reference code.");
    }
    function closeQR() {
        $.win2.children.length > 2 && $.win2.remove($.win2.children[2]);
    }
    function scanCode() {
        setDriver();
        if (Titanium.Platform.model == "Simulator") {
            Ti.App.Properties.setString("pushID", "50dca671c88b503f410a2e22");
            updateCloud();
            setTimeout(function() {
                alert("Parent code set as: 50dca671c88b503f410a2e22\nfor simulator testing");
            }, 3000);
        }
        alert("Scan your parents reference code to activate.");
        var code = require("qrcode");
        code.scan(function(e) {
            if (e.status == 1) {
                Ti.App.Properties.setString("pushID", e.code);
                updateCloud();
            }
        });
    }
    function showParent() {
        getCloud();
        $.reportLabel.show();
        $.parentPin.passwordMask = !1;
        $.reportEmail.show();
        $.vehicleSpeedMax.show();
        $.engineSpeedMax.show();
        $.accelerationXMax.show();
        $.throttlePositionMax.show();
    }
    function changePin(e) {
        if (currentUser == "parent") {
            settings.parentPin = e.source.value;
            updateCloud();
        } else if ($.parentPin.value == settings.parentPin) {
            showParent();
            currentUser = "parent";
        } else alert("Wrong PIN");
    }
    function setParent() {
        $.parentPin.show();
        if (currentUser == "parent" || settings.parentPin == null) {
            currentUser = "parent";
            showParent();
        } else if ($.parentPin.value == settings.parentPin) {
            showParent();
            currentUser = "parent";
        }
    }
    function setDriver() {
        closeQR();
        $.reportLabel.hide();
        $.parentPin.passwordMask = !0;
        $.parentPin.hide();
        $.parentPin.value = "";
        currentUser = "driver";
        $.reportEmail.hide();
        $.vehicleSpeedMax.hide();
        $.engineSpeedMax.hide();
        $.accelerationXMax.hide();
        $.throttlePositionMax.hide();
    }
    require("alloy/controllers/BaseController").apply(this, Array.prototype.slice.call(arguments));
    $model = arguments[0] ? arguments[0].$model : null;
    var $ = this, exports = {}, __defers = {};
    $.__views.index = A$(Ti.UI.createTabGroup({
        id: "index"
    }), "TabGroup", null);
    $.__views.win = A$(Ti.UI.createWindow({
        layout: "vertical",
        backgroundColor: "#000000",
        backgroundImage: "background.png",
        barColor: "#A62D00",
        id: "win",
        title: "Vehicle Data"
    }), "Window", null);
    $.__views.status = A$(Ti.UI.createLabel({
        width: Ti.UI.SIZE,
        height: Ti.UI.SIZE,
        color: "#ffffff",
        font: {
            fontSize: 16,
            fontFamily: "Helvetica Neue"
        },
        textAlign: "center",
        top: 15,
        text: "Connect to start tracking",
        id: "status"
    }), "Label", $.__views.win);
    $.__views.win.add($.__views.status);
    $.__views.maxThrottle = A$(Ti.UI.createLabel({
        width: Ti.UI.SIZE,
        height: Ti.UI.SIZE,
        color: "#ffffff",
        font: {
            fontSize: 16,
            fontFamily: "Helvetica Neue"
        },
        textAlign: "center",
        top: 15,
        id: "maxThrottle"
    }), "Label", $.__views.win);
    $.__views.win.add($.__views.maxThrottle);
    $.__views.maxSpeed = A$(Ti.UI.createLabel({
        width: Ti.UI.SIZE,
        height: Ti.UI.SIZE,
        color: "#ffffff",
        font: {
            fontSize: 16,
            fontFamily: "Helvetica Neue"
        },
        textAlign: "center",
        top: 15,
        id: "maxSpeed"
    }), "Label", $.__views.win);
    $.__views.win.add($.__views.maxSpeed);
    $.__views.maxRpm = A$(Ti.UI.createLabel({
        width: Ti.UI.SIZE,
        height: Ti.UI.SIZE,
        color: "#ffffff",
        font: {
            fontSize: 16,
            fontFamily: "Helvetica Neue"
        },
        textAlign: "center",
        top: 15,
        id: "maxRpm"
    }), "Label", $.__views.win);
    $.__views.win.add($.__views.maxRpm);
    $.__views.maxAcceleration = A$(Ti.UI.createLabel({
        width: Ti.UI.SIZE,
        height: Ti.UI.SIZE,
        color: "#ffffff",
        font: {
            fontSize: 16,
            fontFamily: "Helvetica Neue"
        },
        textAlign: "center",
        top: 15,
        id: "maxAcceleration"
    }), "Label", $.__views.win);
    $.__views.win.add($.__views.maxAcceleration);
    $.__views.connectBtn = A$(Ti.UI.createButton({
        width: "50%",
        height: 40,
        top: 20,
        backgroundImage: "button.png",
        color: "#ffffff",
        title: "connect to vehicle",
        id: "connectBtn"
    }), "Button", $.__views.win);
    $.__views.win.add($.__views.connectBtn);
    $.__views.__alloyId1 = A$(Ti.UI.createTab({
        window: $.__views.win,
        title: "Data",
        icon: "dataIcon.png",
        id: "__alloyId1"
    }), "Tab", null);
    $.__views.index.addTab($.__views.__alloyId1);
    $.__views.win2 = A$(Ti.UI.createWindow({
        layout: "vertical",
        backgroundColor: "#000000",
        backgroundImage: "background.png",
        barColor: "#A62D00",
        id: "win2",
        title: "User Connection"
    }), "Window", null);
    $.__views.qrcodeBtn = A$(Ti.UI.createButton({
        width: "50%",
        height: 40,
        top: "20",
        backgroundImage: "button.png",
        color: "#ffffff",
        title: "Set as Parent",
        id: "qrcodeBtn"
    }), "Button", $.__views.win2);
    $.__views.win2.add($.__views.qrcodeBtn);
    displayReference ? $.__views.qrcodeBtn.on("click", displayReference) : __defers["$.__views.qrcodeBtn!click!displayReference"] = !0;
    $.__views.displayBtn = A$(Ti.UI.createButton({
        width: "50%",
        height: 40,
        top: "20",
        backgroundImage: "button.png",
        color: "#ffffff",
        title: "Set as Driver",
        id: "displayBtn"
    }), "Button", $.__views.win2);
    $.__views.win2.add($.__views.displayBtn);
    scanCode ? $.__views.displayBtn.on("click", scanCode) : __defers["$.__views.displayBtn!click!scanCode"] = !0;
    $.__views.__alloyId2 = A$(Ti.UI.createTab({
        window: $.__views.win2,
        title: "Connect",
        icon: "connectIcon.png",
        id: "__alloyId2"
    }), "Tab", null);
    $.__views.index.addTab($.__views.__alloyId2);
    $.__views.win3 = A$(Ti.UI.createWindow({
        layout: "vertical",
        backgroundColor: "#000000",
        backgroundImage: "background.png",
        barColor: "#A62D00",
        id: "win3",
        title: "Track Settings"
    }), "Window", null);
    $.__views.__alloyId4 = A$(Ti.UI.createScrollView({
        layout: "vertical",
        id: "__alloyId4"
    }), "ScrollView", $.__views.win3);
    $.__views.win3.add($.__views.__alloyId4);
    $.__views.__alloyId5 = A$(Ti.UI.createLabel({
        width: Ti.UI.SIZE,
        height: Ti.UI.SIZE,
        color: "#ffffff",
        font: {
            fontSize: 16,
            fontFamily: "Helvetica Neue"
        },
        textAlign: "center",
        top: 15,
        text: "User Info",
        id: "__alloyId5"
    }), "Label", $.__views.__alloyId4);
    $.__views.__alloyId4.add($.__views.__alloyId5);
    $.__views.driverName = A$(Ti.UI.createTextField({
        width: "70%",
        height: 30,
        borderStyle: Ti.UI.INPUT_BORDERSTYLE_ROUNDED,
        top: 5,
        bottom: 5,
        clearOnEdit: !0,
        clearButtonMode: Ti.UI.INPUT_BUTTONMODE_ONFOCUS,
        id: "driverName",
        type: "driverName",
        hintText: "Driver Name"
    }), "TextField", $.__views.__alloyId4);
    $.__views.__alloyId4.add($.__views.driverName);
    updateSettings ? $.__views.driverName.on("change", updateSettings) : __defers["$.__views.driverName!change!updateSettings"] = !0;
    updateCloud ? $.__views.driverName.on("blur", updateCloud) : __defers["$.__views.driverName!blur!updateCloud"] = !0;
    $.__views.parentPin = A$(Ti.UI.createTextField({
        width: "70%",
        height: 30,
        borderStyle: Ti.UI.INPUT_BORDERSTYLE_ROUNDED,
        top: 5,
        bottom: 5,
        clearOnEdit: !0,
        clearButtonMode: Ti.UI.INPUT_BUTTONMODE_ONFOCUS,
        id: "parentPin",
        type: "parentPin",
        hintText: "PIN",
        passwordMask: "true",
        visible: "false"
    }), "TextField", $.__views.__alloyId4);
    $.__views.__alloyId4.add($.__views.parentPin);
    changePin ? $.__views.parentPin.on("blur", changePin) : __defers["$.__views.parentPin!blur!changePin"] = !0;
    $.__views.reportEmail = A$(Ti.UI.createTextField({
        width: "70%",
        height: 30,
        borderStyle: Ti.UI.INPUT_BORDERSTYLE_ROUNDED,
        top: 5,
        bottom: 5,
        clearOnEdit: !0,
        clearButtonMode: Ti.UI.INPUT_BUTTONMODE_ONFOCUS,
        id: "reportEmail",
        type: "reportEmail",
        hintText: "Report Email",
        visible: "false"
    }), "TextField", $.__views.__alloyId4);
    $.__views.__alloyId4.add($.__views.reportEmail);
    updateSettings ? $.__views.reportEmail.on("change", updateSettings) : __defers["$.__views.reportEmail!change!updateSettings"] = !0;
    updateCloud ? $.__views.reportEmail.on("blur", updateCloud) : __defers["$.__views.reportEmail!blur!updateCloud"] = !0;
    $.__views.reportLabel = A$(Ti.UI.createLabel({
        width: Ti.UI.SIZE,
        height: Ti.UI.SIZE,
        color: "#ffffff",
        font: {
            fontSize: 16,
            fontFamily: "Helvetica Neue"
        },
        textAlign: "center",
        top: 15,
        text: "Reporting Limits",
        id: "reportLabel",
        visible: "false"
    }), "Label", $.__views.__alloyId4);
    $.__views.__alloyId4.add($.__views.reportLabel);
    $.__views.vehicleSpeedMax = A$(Ti.UI.createTextField({
        width: "70%",
        height: 30,
        borderStyle: Ti.UI.INPUT_BORDERSTYLE_ROUNDED,
        top: 5,
        bottom: 5,
        clearOnEdit: !0,
        clearButtonMode: Ti.UI.INPUT_BUTTONMODE_ONFOCUS,
        id: "vehicleSpeedMax",
        type: "vehicleSpeed",
        hintText: "Speed Limit",
        visible: "false"
    }), "TextField", $.__views.__alloyId4);
    $.__views.__alloyId4.add($.__views.vehicleSpeedMax);
    updateSettings ? $.__views.vehicleSpeedMax.on("change", updateSettings) : __defers["$.__views.vehicleSpeedMax!change!updateSettings"] = !0;
    addExtension ? $.__views.vehicleSpeedMax.on("blur", addExtension) : __defers["$.__views.vehicleSpeedMax!blur!addExtension"] = !0;
    $.__views.throttlePositionMax = A$(Ti.UI.createTextField({
        width: "70%",
        height: 30,
        borderStyle: Ti.UI.INPUT_BORDERSTYLE_ROUNDED,
        top: 5,
        bottom: 5,
        clearOnEdit: !0,
        clearButtonMode: Ti.UI.INPUT_BUTTONMODE_ONFOCUS,
        id: "throttlePositionMax",
        type: "throttlePosition",
        hintText: "Throttle Position",
        visible: "false"
    }), "TextField", $.__views.__alloyId4);
    $.__views.__alloyId4.add($.__views.throttlePositionMax);
    updateSettings ? $.__views.throttlePositionMax.on("change", updateSettings) : __defers["$.__views.throttlePositionMax!change!updateSettings"] = !0;
    addExtension ? $.__views.throttlePositionMax.on("blur", addExtension) : __defers["$.__views.throttlePositionMax!blur!addExtension"] = !0;
    $.__views.engineSpeedMax = A$(Ti.UI.createTextField({
        width: "70%",
        height: 30,
        borderStyle: Ti.UI.INPUT_BORDERSTYLE_ROUNDED,
        top: 5,
        bottom: 5,
        clearOnEdit: !0,
        clearButtonMode: Ti.UI.INPUT_BUTTONMODE_ONFOCUS,
        id: "engineSpeedMax",
        type: "engineSpeed",
        hintText: "RPM Limit",
        visible: "false"
    }), "TextField", $.__views.__alloyId4);
    $.__views.__alloyId4.add($.__views.engineSpeedMax);
    updateSettings ? $.__views.engineSpeedMax.on("change", updateSettings) : __defers["$.__views.engineSpeedMax!change!updateSettings"] = !0;
    addExtension ? $.__views.engineSpeedMax.on("blur", addExtension) : __defers["$.__views.engineSpeedMax!blur!addExtension"] = !0;
    $.__views.accelerationXMax = A$(Ti.UI.createTextField({
        width: "70%",
        height: 30,
        borderStyle: Ti.UI.INPUT_BORDERSTYLE_ROUNDED,
        top: 5,
        bottom: 5,
        clearOnEdit: !0,
        clearButtonMode: Ti.UI.INPUT_BUTTONMODE_ONFOCUS,
        id: "accelerationXMax",
        type: "accelerationX",
        hintText: "G-Force Limit",
        visible: "false"
    }), "TextField", $.__views.__alloyId4);
    $.__views.__alloyId4.add($.__views.accelerationXMax);
    updateSettings ? $.__views.accelerationXMax.on("change", updateSettings) : __defers["$.__views.accelerationXMax!change!updateSettings"] = !0;
    addExtension ? $.__views.accelerationXMax.on("blur", addExtension) : __defers["$.__views.accelerationXMax!blur!addExtension"] = !0;
    $.__views.__alloyId3 = A$(Ti.UI.createTab({
        window: $.__views.win3,
        title: "Settings",
        icon: "settingsIcon.png",
        id: "__alloyId3"
    }), "Tab", null);
    $.__views.index.addTab($.__views.__alloyId3);
    $.addTopLevelView($.__views.index);
    exports.destroy = function() {};
    _.extend($, $.__views);
    $.index.open();
    var acs = require("acs"), vehicleModule = require("jp.co.denso.vehiclemodule"), Barcode = require("ti.barcode"), vehicleObject = null, report = "", track = {
        throttlePosition: {
            flag: !1,
            max: 0
        },
        vehicleSpeed: {
            flag: !1,
            max: 0
        },
        accelerationX: {
            flag: !1,
            max: 0
        },
        engineSpeed: {
            flag: !1,
            max: 0
        },
        transmission: {
            flag: !1,
            status: null
        },
        trip: {
            start: null,
            end: null
        },
        temp: {
            flag: !1,
            min: null,
            max: null
        },
        light: {
            flag: !1
        },
        location: {
            flag: !1,
            lat: null,
            lon: null
        }
    }, currentUser = null, settings = {
        driverName: "Test Driver",
        reportEmail: null,
        parentPin: null,
        throttlePosition: {
            max: 75,
            notify: !0,
            extension: "%"
        },
        vehicleSpeed: {
            max: 105,
            notify: !0,
            extension: " mph",
            conversion: !0
        },
        accelerationX: {
            max: 10,
            notify: !0,
            extension: " g-force",
            conversion: !0
        },
        engineSpeed: {
            max: 8000,
            notify: !0,
            extension: " rpm"
        },
        latitude: {
            max: null,
            min: null,
            notify: !0
        },
        longitude: {
            max: null,
            min: null,
            notify: !0
        }
    }, conversion = {
        vehicleSpeed: function(e) {
            return e.type == "out" ? Math.round(parseFloat(e.value) * 0.621371) : Math.round(parseFloat(e.value) * 1.60934);
        },
        accelerationX: function(e) {
            return e.type == "out" ? (parseFloat(e.value) / 9.8).toFixed(2) : parseFloat(e.value) * 9.8;
        }
    };
    populateSettings();
    $.connectBtn.addEventListener("click", vehicleConnect);
    if (Ti.App.Properties.hasProperty("UUID")) acs.userLogin({
        success: loggedIn
    }); else {
        Ti.App.Properties.setString("UUID", Ti.Platform.createUUID());
        acs.userCreate({
            success: loggedIn
        });
    }
    __defers["$.__views.qrcodeBtn!click!displayReference"] && $.__views.qrcodeBtn.on("click", displayReference);
    __defers["$.__views.displayBtn!click!scanCode"] && $.__views.displayBtn.on("click", scanCode);
    __defers["$.__views.driverName!change!updateSettings"] && $.__views.driverName.on("change", updateSettings);
    __defers["$.__views.driverName!blur!updateCloud"] && $.__views.driverName.on("blur", updateCloud);
    __defers["$.__views.parentPin!blur!changePin"] && $.__views.parentPin.on("blur", changePin);
    __defers["$.__views.reportEmail!change!updateSettings"] && $.__views.reportEmail.on("change", updateSettings);
    __defers["$.__views.reportEmail!blur!updateCloud"] && $.__views.reportEmail.on("blur", updateCloud);
    __defers["$.__views.vehicleSpeedMax!change!updateSettings"] && $.__views.vehicleSpeedMax.on("change", updateSettings);
    __defers["$.__views.vehicleSpeedMax!blur!addExtension"] && $.__views.vehicleSpeedMax.on("blur", addExtension);
    __defers["$.__views.throttlePositionMax!change!updateSettings"] && $.__views.throttlePositionMax.on("change", updateSettings);
    __defers["$.__views.throttlePositionMax!blur!addExtension"] && $.__views.throttlePositionMax.on("blur", addExtension);
    __defers["$.__views.engineSpeedMax!change!updateSettings"] && $.__views.engineSpeedMax.on("change", updateSettings);
    __defers["$.__views.engineSpeedMax!blur!addExtension"] && $.__views.engineSpeedMax.on("blur", addExtension);
    __defers["$.__views.accelerationXMax!change!updateSettings"] && $.__views.accelerationXMax.on("change", updateSettings);
    __defers["$.__views.accelerationXMax!blur!addExtension"] && $.__views.accelerationXMax.on("blur", addExtension);
    _.extend($, exports);
}

var Alloy = require("alloy"), Backbone = Alloy.Backbone, _ = Alloy._, A$ = Alloy.A, $model;

module.exports = Controller;