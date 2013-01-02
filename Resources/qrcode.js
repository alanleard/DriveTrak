var Barcode = require("ti.barcode"), qrcode = {
    scan: function(_callback) {
        if (Ti.Platform.osname != "android") {
            var Barcode = require("ti.barcode");
            Barcode.allowRotation = !0;
            Barcode.displayedMessage = "Scan your parents reference code";
            Barcode.allowMenu = !1;
            Barcode.allowInstructions = !1;
            Barcode.useLED = !1;
            Barcode.capture({
                animate: !0,
                showCancel: !0,
                showRectangle: !0,
                keepOpen: !1
            });
            Barcode.addEventListener("error", function(x) {
                alert("Error");
                _callback({
                    status: !1,
                    code: null,
                    message: "Error"
                });
            });
            Barcode.addEventListener("cancel", function(x) {
                alert("Cancel received");
                _callback({
                    status: !1,
                    code: null,
                    message: "Canceled"
                });
            });
            Barcode.addEventListener("success", function(x) {
                alert("Success called with reference code: " + x.result);
                _callback({
                    status: !0,
                    code: x.result,
                    message: "Success"
                });
            });
        }
    }
};

module.exports = qrcode;