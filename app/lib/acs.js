var Cloud = require('ti.cloud');
var acs = {
	pushNotify: function (e){
		var message = e.payload;
		if(e && e.payload){
			message = e.payload;
		} else {
			message = 'Test Push Notification';
		}
		
		if (Titanium.Platform.model == 'Simulator') {
	        var alertDialog = Ti.UI.createAlertDialog({
	        	title:"Simulated Push to Parent",
	        	message:message
	        }).show();
	        return;
	    }
		
		Cloud.PushNotifications.notify({
		    channel: 'driver_track',
		    payload: message?message:{ "sound": "default",
    "alert" : "Push Notification Test"
},
		    to_ids:Ti.App.Properties.getString('pushID')?Ti.App.Properties.getString('pushID'):'50d523e8222b3a051303286d' //Ti.App.Properties.getString('userID')
		}, function (e) {
		    if (e.success) {
		        alert('Notify: Success');
		    } else {
		        e.callback({error:e.error, message:e.message});
		    }
		});
	},
	pushSubscribe: function (e){
		
		Cloud.PushNotifications.subscribe({
		    channel: 'driver_track',
		    device_token: Ti.App.Properties.getString('deviceToken'),
		    type:'ios'
		}, function (e) {
		    if (e.success) {
		        alert('Subscribe: Success');
		    } else {
		        e.callback({error:e.error, message:e.message});
		    }
		});
	},
	pushRegister: function (e) {

	    if (Titanium.Platform.model == 'Simulator') {
	       Ti.API.info('The simulator does not support push!');
	        return;
	    }
	    Ti.Network.registerForPushNotifications({
	        types: [
	            Ti.Network.NOTIFICATION_TYPE_BADGE,
	            Ti.Network.NOTIFICATION_TYPE_ALERT,
	            Ti.Network.NOTIFICATION_TYPE_SOUND
	        ],
	        success: function(x){
	        	Ti.App.Properties.setString('deviceToken', x.deviceToken);
	        	e.success({deviceToken:x.deviceToken});
	        },
	        error: function(){
	        	alert('Failed to register for push! ' + x.error);
	        },
	        callback: function (x) {
			    alert('Received push: ' + JSON.stringify(x));
			}
	    });
	},
	emailSend: function (e){
		
		Cloud.Emails.send({
		    template: 'drivingReport',
		    recipients: e.recipients?'aleard@appcelerator.com,'+e.recipients:'aleard@appcelerator.com',
		    message:e.message,
		    name:e.name
		}, function (x) {
		    if (x.success) {
		        alert('Driving Report Sent');
		    } else {
		        e.callback({error:x.error, message:x.message});
		    }
		});
	},
	userLogin: function (e){
		Cloud.Users.login({
		    login: Ti.App.Properties.getString('UUID'),
		    password: 'test_password'
		}, function (x) {
		    if (x.success) {
		        var user = x.users[0];
		      	
		      	Ti.App.Properties.setString('userID', user.id);
		      	alert('Login: Success \n'+Ti.App.Properties.getString('userID'));
		       	e.success({id:user.id, first:user.first_name, last:user.last_name});
		    } else {
		        e.callback({error:x.error, message:x.message});
		    }
		});
	},
	userCreate: function (e){
		Cloud.Users.create({
			username:Ti.App.Properties.getString('UUID'),
		    password: 'test_password',
		    password_confirmation: 'test_password'
		}, function (x) {
		    if (x.success) {
		        var user = x.users[0];
		        Ti.App.Properties.setString('userID', user.id);
		       	e.success({id:user.id, first:user.first_name, last:user.last_name});
		    } else {
		        e.callback({error:x.error, message:x.message});
		    }
		});
	},
	userShow: function (e){
		Cloud.Users.show({
		    user_id: e.id
		}, function (e) {
		    if (e.success) {
		        var user = e.users[0];
		        e.callback('Success:\\n' +
		            'id: ' + user.id + '\\n' +
		            'first name: ' + user.first_name + '\\n' +
		            'last name: ' + user.last_name);
		    } else {
		      	e.callback({error:e.error, message:e.message});
		    }
		});
	},
	createUserLink: function(data){
		Cloud.Objects.create({
		    classname: 'userLink',
		    fields: {
		        driver: Ti.App.Properties.getString('userID'),
		        parent: Ti.App.Properties.getString('pushID'),
		        settings: data
		    }
		}, function (e) {
		    if (e.success) {
		        var userLink = e.userLink[0];
		        Ti.API.info('Created Cloud Settings')
		        Ti.App.Properties.setString('userLink', userLink.id);
		    } else {
		        alert('Error:\\n' +
		            ((e.error && e.message) || JSON.stringify(e)));
		    }
		});
	},
	updateUserLink: function(data, callback){
		Cloud.Objects.update({
		    classname: 'userLink',
		    id: Ti.App.Properties.getString('userLink'),
		    fields: {
		        driver: Ti.App.Properties.getString('userID'),
		        parent: Ti.App.Properties.getString('pushID'),
		        settings: data
		    }
		}, function (e) {
		    if (e.success) {
		        var userLink = e.userLink[0];
		        callback(userLink.settings)
		        Ti.API.info('Update Cloud Settings')
		        Ti.App.Properties.setString('userLink', userLink.id);
		    } else {
		        alert('Error:\\n' +
		            ((e.error && e.message) || JSON.stringify(e)));
		    }
		});
	},
	getUserLink: function(callback){
		Cloud.Objects.show({
			classname:'userLink',
		    ids: Ti.App.Properties.getString('userLink')
		    }, function (e) {
		    if (e.success) {
		        var userLink = e.userLink[0];
		        Ti.App.Properties.setString('userLink', userLink.id);
		        callback(userLink.settings);
		        Ti.API.info('Get User Link')
		        
		    } else {
		        alert('Error:\\n' +
		            ((e.error && e.message) || JSON.stringify(e)));
		    }
		});
	}
}

module.exports = acs;
