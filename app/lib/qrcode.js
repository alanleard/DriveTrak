var Barcode = require('ti.barcode');

var qrcode = {
	scan : function(_callback){
		if(Ti.Platform.osname!='android'){

		var Barcode = require('ti.barcode');
		Barcode.allowRotation = true;
		Barcode.displayedMessage = 'Scan your parents reference code';
		Barcode.allowMenu = false;
		Barcode.allowInstructions = false;
		Barcode.useLED = false;
		
		Barcode.capture({
		    animate: true,
		    showCancel: true,
		    showRectangle: true,
		    keepOpen: false
		});
		
		Barcode.addEventListener('error', function (x) {
			alert('Error');
			_callback({status:false, code:null, message: 'Error'});
		});
		Barcode.addEventListener('cancel', function (x) {
		   // alert('Cancel received');
		    _callback({status:false, code:null, message: 'Canceled'});
		    
		});
		Barcode.addEventListener('success', function (x) {
		    alert('Success called with reference code: ' + x.result);
		    _callback({status:true, code:x.result, message:'Success'});
		});
		}
	}
}
module.exports = qrcode;