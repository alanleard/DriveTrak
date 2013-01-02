
//Open the tabgroup
$.index.open();

//Assign variables
 
//Require ACS module
var	acs = require('acs'),
	
//DEVICE TESTING: Comment to build to device
vehicleModule = require('jp.co.denso.vehiclemodule'),

//Require the Barcode module
Barcode = require('ti.barcode'),

//Create the vehicleObject
vehicleObject=null,

//Create a blank report string variable to store the driving report
report = '',

//Create the 'track' object to define the properties to be tracked
track = {
	throttlePosition:{
		flag:false,
		max:0
	},
	vehicleSpeed:{
		flag:false,
		max:0
	},
	accelerationX:{
		flag:false,
		max:0
	},
	engineSpeed:{
		flag:false,
		max:0
	},
	transmission:{
		flag:false,
		status:null
	},
	trip:{
		start:null,
		end:null
	},
	temp:{
		flag:false,
		min:null,
		max:null
	},
	light:{
		flag:false
	},
	location:{
		flag:false,
		lat:null,
		lon:null
	}
},

//Create a place holder for the current user role
currentUser = null,

//Create the 'settings' object to define the default user settings
settings = {
	driverName: "Test Driver",
	reportEmail: null,
	parentPin: null,
	throttlePosition:{
		max:75,
		notify:true,
		extension:"%"
	},
	vehicleSpeed:{
		max:75,
		notify:true,
		extension:" mph",
		conversion: true
	},
	accelerationX:{
		max:4,
		notify:true,
		extension:" g-force",
		conversion: true
		
	},
	engineSpeed:{
		max:8000,
		notify:false,
		extension:" rpm"
	},
	latitude:{
		max:null,
		min:null,
		notify:true
	},
	longitude:{
		max:null,
		min:null,
		notify:true
	}
},

//Create conversion functions for speed (kph/mph) and acceleration/g-force
conversion = {
	vehicleSpeed: function(e){
		if(e.type == "out"){
			return Math.round(parseFloat(e.value)*0.621371)
		} else {
			return Math.round(parseFloat(e.value)*1.60934)
		}
	},
	accelerationX: function(e){
		if(e.type == "out"){
			
			return ((parseFloat(e.value))/9.8).toFixed(2)
		} else {
			return (parseFloat(e.value)*9.8)
		}
	}
}

//populate the settings fields
populateSettings();

//Check if a UUID has been assigned and login or create a login
if(Ti.App.Properties.hasProperty('UUID')){
	acs.userLogin({success:loggedIn});
} else{
	Ti.App.Properties.setString('UUID', Ti.Platform.createUUID());
	acs.userCreate({success:loggedIn});
}

//DEVICE TESTING: Comment to build to device (Module cannot be built to device)
// $.connectBtn.addEventListener('click', function(){
	// acs.pushNotify({message:'Push from '+Ti.App.Properties.getString('UUID')});
// });

//Get a list of devices that can be connected from application
function vehicleConnect(){
	
	// Search for available vehicles
	vehicleModule.startSearchDevice(deviceSearch);
	
	//Update button status
	$.connectBtn.title = 'waiting for vehicle'
};

//Search for an available device and connect
function deviceSearch(device){
	
	// Stop vehicle search
	vehicleModule.stopSearchDevice();
	
	// Log vehicle ID
	Ti.API.info(device.id);
	
  	// Set vehicle object
	vehicleObject =vehicleModule.createVehicleInterface({
		device: device
	});
	
	// Adds an event listener for get connection status
	vehicleObject.addEventListener('connectionStatus', connect);
	
	// Connecting to the device and authenticating the application
	vehicleObject.connect();
	
	
};

//Check connection status and either started connected activity or disconnect
function connect(e){
	
	// Log successful connection	
	Ti.API.info("status=" + e.status);
	
	if(e.status == 'connected'){
		
		// Set button and label
		$.connectBtn.title = 'disconnect';
		$.status.text = 'Ready to Track';
		
		// Start listening for driving operation changes
		vehicleObject.addEventListener('drivingOperation', didReceiveDrivingOperation );
		
		// Change connect button event listeners
		$.connectBtn.removeEventListener('click', vehicleConnect);
		$.connectBtn.addEventListener('click', disconnect);
	} else {
		
		//Disconnect from device
		disconnect(e)
	}
};
	
//Disconnect from the device and prepare to reconnect		
function disconnect(e) {
	
	// Update button title
	$.connectBtn.title = 'connect to vehicle';
	
	// Remove an event listener
	if(vehicleObject!=null){
		vehicleObject.removeEventListener('drivingOperation', didReceiveDrivingOperation );

		// Disconnect from the device
		vehicleObject.disconnect();
		
		// Null vehicle onject
		vehicleObject = null;
	}
	
	// Change connect button event listeners
	$.connectBtn.removeEventListener('click', disconnect);
	$.connectBtn.addEventListener('click', vehicleConnect);
};

//Receive vehicle behavior and act on it
function didReceiveVehicleBehavior(e)
{
	//Track the current data points
	vehicleBehaviorTrack({label:$.maxSpeed, type:'vehicleSpeed', title:"Vehicle Speed", data:e.vehicleSpeed})
	vehicleBehaviorTrack({label:$.maxThrottle, type:'throttlePosition', title:"Throttle Rate", data: e.throttlePosition});
	vehicleBehaviorTrack({label:$.maxRpm, type:'engineSpeed', title:"Engine Speed", data: e.engineSpeed});
	vehicleBehaviorTrack({label:$.maxAcceleration, type:'accelerationX', title:"Acceleration", data: e.accelerationX});
	
	// e.latitude
	// e.longitude
	// e.fuelConsumption
};

//Check rules then report & notify accordingly
function vehicleBehaviorTrack(e){
	var vData = e.data;
	
	//If there is a conversion necessary, do it
	if(settings[e.type].conversion){
		vData = conversion[e.type]({type:"out",value:e.data});
	}
	
	//If the data is greater then the current max, record it
	if(vData>track[e.type].max || track[e.type].max == 0){
		track[e.type].max = vData;
		e.label.text = "Max "+e.title+": "+track[e.type].max+settings[e.type].extension
	}
	
	//If the data is greater then the current user setting limit, notify & report
	if(e.data>settings[e.type].max){

		if(!track[e.type].flag){
			track[e.type].flag = true;
			if(settings[e.type].notify){
				acs.pushNotify({payload:"Drive Track Alert for "+settings.driverName+"\n\n"+e.title+" exceeded limit of "+settings[e.type].max+settings[e.type].extension});
			}
			
		} else {
			if(!track[e.type].current || vData>track[e.type].current){
				track[e.type].current = vData;
			}
		}
		
	}
	
	//If the data is below the limit, turn the tracking flag off and append the report of the incident
	if(e.data<settings[e.type].max){
		if(track[e.type].flag){
			track[e.type].flag = false;
			appendReport({title:e.title+" Limit Exceeded", detail:track[e.type].current+settings[e.type].extension});
			track[e.type].current = null;
		} 
		
	}
}

//Receive initial driving behavior (changing out of Park starts the reporting)
function didReceiveDrivingOperation(e)
{	
	//When transmission is moved from park, start tracking
	if(e.transmissionRange != 0 && !track.transmission.flag){
		if(e.parkingBrakeStatus==1){
			alert('WARNING: Your parking break is still on.');
		};
		
		//Check if there are settings stored in the cloud and update the local settings
		getCloud();
		
		//Add vehicle event listeners
		vehicleObject.addEventListener('vehicleBehavior', didReceiveVehicleBehavior );
		//vehicleObject.addEventListener('vehicleStatus', didReceiveVehicleStatus );
		
		//Set tracking flag to true
		track.transmission.flag = true;
		
		//Create a report string and set the start time
		var startTime = new Date().toLocaleString();
		track.trip.start = startTime;
		createReport(startTime);
		
		//Update the status text
		$.status.text = 'Tracking';
		alert('Start Tracking: '+track.trip.start);
	
	} else if(e.transmissionRange == 0 && track.transmission.flag){
			
			//Stop tracking and finalize 
			vehicleObject.removeEventListener('vehicleBehavior', didReceiveVehicleBehavior );
			//vehicleObject.removeEventListener('vehicleStatus', didReceiveVehicleStatus );
			track.transmission.flag = false;
			
			//Finalize and send report via email
			var endTime = new Date().toLocaleString();
			track.trip.end = endTime;
			finalizeReport(endTime);
			acs.emailSend({message:report, recipients:settings.reportEmail, name: settings.driverName})
			
			//Update status label and alert user
			$.status.text = 'Stopped Tracking';
			alert('End Tracking: '+track.trip.end);
			
	}
	
	//Track the transmission status
	track.transmission.status = e.transmissionRange;
};

//Populate the settings textfields
function populateSettings(data){
	if(data!=null){
		settings = data;
	}
	$.driverName.value = settings.driverName;
	$.reportEmail.value = settings.reportEmail;
	$.vehicleSpeedMax.value = conversion['vehicleSpeed']({type:"out", value:settings.vehicleSpeed.max})+settings.vehicleSpeed.extension;
	$.engineSpeedMax.value = settings.engineSpeed.max+settings.engineSpeed.extension;
	$.accelerationXMax.value = conversion['accelerationX']({type:"out",value:settings.accelerationX.max})+settings.accelerationX.extension;
	$.throttlePositionMax.value = settings.throttlePosition.max+settings.throttlePosition.extension;
}

//Update settings on textField CHANGE
function updateSettings(e){
	if(e.source.type != "driverName" && e.source.type != "reportEmail" ){
		if(e.source.value.length>0){
			
			if(settings[e.source.type].conversion){
				settings[e.source.type].max = conversion[e.source.type]({type:"in", value:e.source.value});
			} else {
				settings[e.source.type].max = e.source.value;
			}
	
		}
	} else {
		settings[e.source.type] = e.source.value;
	}
	
}

//Insert extension title at the end of the textField and update Cloud on BLUR
function addExtension(e){
	if(e.source.value){
		e.source.value += settings[e.source.type].extension
	} else {
		if(settings[e.source.type].conversion){
				e.source.value = conversion[e.source.type]({type:"out", value:settings[e.source.type].max})+settings[e.source.type].extension
			} else {
				e.source.value = settings[e.source.type].max+settings[e.source.type].extension
			}
	}
	//
	updateCloud()
}

//Update the ACS custom object to maintain state across devices
function updateCloud(){
	if(Ti.App.Properties.hasProperty('pushID')){
		if(Ti.App.Properties.hasProperty('userLink')){
			acs.updateUserLink(settings, populateSettings);
		} else {
			acs.createUserLink(settings);
		}
	}
}

//Get settings from the cloud
function getCloud(){
	if(Ti.App.Properties.hasProperty('userLink')){
			acs.getUserLink(function(e){
				populateSettings(e);
			})
	}
}

//Action on Logging in (Register/Subscribe for Push and get cloud data)
function loggedIn(){
	//Register for push notification and subscribe to default channel on success
	acs.pushRegister({success:acs.pushSubscribe});
	getCloud();
}

//Start the report string
function createReport(startTime){
	report = "<p><b>Drive Track Driving Report Details for "+settings.driverName+"</b><br><br>Start Time: "+startTime+"</p><p>"
}

//Apend the report as statuses come in
function appendReport(data){
	var date = new Date();
	var hour = date.getHours();
	var minutes = (date.getMinutes()<10?'0':'') + date.getMinutes()
	var time = hour+":"+minutes;
	report += data.title+": "+data.detail+ " (Time: " +time+")<br>"
}

//Finalize the email report and rest maximums
function finalizeReport(endTime){
	report += "</p><p>End Time: "+endTime+"<br><br>Max Speed: "+track.vehicleSpeed.max+"<br>Max RPMs: "+track.engineSpeed.max+"<br>Max Acceleration: "+track.accelerationX.max+"<br>Max Throttle: "+track.throttlePosition.max+"<br></p>"
	track.vehicleSpeed.max = 0;
	track.engineSpeed.max = 0;
	track.accelerationX.max = 0;
	track.throttlePosition.max = 0;
	
}

//Display the reference QR code to set the parent device for push notification and cloud settings
function displayReference(){
	if(Ti.Network.online == true){
		alert('Have driver scan your reference code to activate.');
		setParent();
		if($.win2.children.length<3){
			
			//Send userID to QR serve and get back QR Image
			var qrView = Ti.UI.createImageView({
				top:20,
				image:'http://dev2app.com/qr/?data='+Ti.App.Properties.getString('userID'),
			});
			
			$.win2.add(qrView);
			qrView.addEventListener('click', closeQR);
		}
	
	} else {
		alert('You must be online to display your current reference code.');
	}
};

//Close the QR code image
function closeQR(){
	if($.win2.children.length>2){
		$.win2.remove($.win2.children[2]);
	}
};

//QR Code scan function to connect two users for push notification and cloud settings
function scanCode(){
	setDriver();
	if (Titanium.Platform.model == 'Simulator') {
		Ti.App.Properties.setString('pushID', '50dca671c88b503f410a2e22');
		
		updateCloud();
		
		setTimeout(function(){
			alert('Parent code set as: 50dca671c88b503f410a2e22\nfor simulator testing');
		}, 3000);
	} 
	
	alert('Scan your parents reference code to activate.');
	
	var code = require('qrcode');
	
	code.scan(function(e){
		if(e.status == true){
			Ti.App.Properties.setString('pushID', e.code);
			updateCloud();
		}
	});
}

//Display parent setting textFields and get latest cloud settings
function showParent(){
	getCloud();
	$.reportLabel.show();
	$.parentPin.passwordMask = false;
	$.reportEmail.show();
	$.vehicleSpeedMax.show();
	$.engineSpeedMax.show();
	$.accelerationXMax.show();
	$.throttlePositionMax.show();
}

//Change or set PIN for parent security
function changePin(e){
	if(currentUser == 'parent'){
		settings.parentPin = e.source.value;
		updateCloud();
	} else {
		if($.parentPin.value == settings.parentPin){
			showParent();
			currentUser = 'parent';
		} else {
			alert('Wrong PIN')
		}
	}
}

//Set current user as 'Parent' and get proper settings
function setParent(){
	$.parentPin.show();
	if(currentUser == 'parent' || settings.parentPin == null){
			currentUser = 'parent';
			showParent();
	}else{
		if($.parentPin.value == settings.parentPin){
			showParent();
			currentUser = 'parent';
		} 
	}
	
}

//Set current user as 'Driver' and get proper settings
function setDriver(){
	closeQR();
	$.reportLabel.hide();
	$.parentPin.passwordMask = true;
	$.parentPin.hide();
	$.parentPin.value = '';
	currentUser = 'driver';
	$.reportEmail.hide();
	$.vehicleSpeedMax.hide();
	$.engineSpeedMax.hide();
	$.accelerationXMax.hide();
	$.throttlePositionMax.hide();
}

// function didReceiveVehicleStatus(e){
// 
	// var d = new Date();
	// var n = d.getHours();
	// if(n>16 && !track.light.flag){
		// if(e.frontLightStatus=='off'){
			// alert('WARNING: Headlights are currently '+e.frontLightStatus)
			// track.light.flag = true;
		// }
	// }
	// if(e.engineWaterTemperature>80){
		// alert('Car overheating')
	// }
// 	
	// if(e.outsideTemperature<=3 && !track.temp.flag) {
		// track.temp.flag = true;
		// alert('Be careful, its cold (temperature):'+e.outsideTemperature)
	// } else if(e.outsideTemperature>3 && track.temp.flag){
		// track.temp.flag = false;
	// }
	// if(track.temp.min == null){
		// track.temp.min = e.outsideTemperature;
	// }
	// if(track.temp.max == null){
		// track.temp.min = e.outsideTemperature;
	// }
	// if(e.outsideTemperature>track.temp.max){
		// track.temp.max = e.outsideTemperature;
	// }
	// if(e.outsideTemperature<track.temp.min){
		// track.temp.min = e.outsideTemperature;
	// }
// };
