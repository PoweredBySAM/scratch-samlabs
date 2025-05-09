const BLE = require('../../io/ble');
const Base64Util = require('../../util/base64-util');
const RateLimiter = require('../../util/rateLimiter.js');

const SamLabsBLE = {
    battServ: '0000180f-0000-1000-8000-00805f9b34fb',
    batteryLevelCharacteristic: '00002a19-0000-1000-8000-00805f9b34fb',
    SAMServ: '3b989460-975f-11e4-a9fb-0002a5d5c51b',
    SensorCharacteristic: '4c592e60-980c-11e4-959a-0002a5d5c51b',
    ActorCharacteristic: '84fc1520-980c-11e4-8bed-0002a5d5c51b',
    StatusLedCharacteristic: '5baab0a0-980c-11e4-b5e9-0002a5d5c51b',
    SAMBotCommandCharacteristic: 'abcd1234-1234-1234-1234-0002a5d5c51b',
    sendInterval: 50,
    sendRateMax: 20
};

const BabyBotIndex = 1;
const SensorBeginIndex = 2;
const SensorEndIndex = 7;
const ButtonIndex = 8;
const rgbIndex = 9;
const motorIndex = 10;
const servoIndex = 11;

const DeviceTypes = [
    {name: 'undefined', advName: ''},
    {name: 'Baby SAM Bot', advName: 'SAM BabyBot'},
    {name: 'slider', advName: 'SAM Potentiometer'},
    {name: 'light sensor', advName: 'SAM LDR'},
    {name: 'proximity', advName: 'SAM IR Sensor'},
    {name: 'heat', advName: 'SAM Temperature'},
    {name: 'tilt', advName: 'SAM Tilt'},
    {name: 'pressure', advName: 'SAM Pressure'},
    {name: 'button', advName: 'SAM Button'},
    {name: 'RGB led', advName: 'SAM RGB LED'},
    {name: 'DC motor', advName: 'SAM DC Motor'},
    {name: 'servo', advName: 'SAM Servo Motor'}
];

class SAMDevice {
    id = '';
    /**
     * @type {BluetoothDevice | Object}
     */
    device;
    typeId = 0;
    deviceType = DeviceTypes[0];
    displayName = `${DeviceTypes[0].name} 1`;
    sameDevices = 1;
    /**
     * @brief brightness for leds, 0...1
     * @type {Number}
     */
    brightness = 1;
    statusLedBrightness = 1;
    lastActorValue = [0, 0, 0];
    lastStatusLEDValue = [0, 0, 0];
    SensorAvailable = false;
    ActorAvailable = false;
    SAMBotAvailable = false;
    /**
     * @type {BluetoothRemoteGATTCharacteristic}
     */
    batteryLevelCharacteristic;
    /**
     * @type {BluetoothRemoteGATTCharacteristic}
     */
    SAMSensorCharacteristic;
    /**
     * @type {BluetoothRemoteGATTCharacteristic}
     */
    SAMActorCharacteristic;
    /**
     * @type {BluetoothRemoteGATTCharacteristic}
     */
    SAMBotCharacteristic;
    /**
     * @type {BluetoothRemoteGATTCharacteristic}
     */
    SAMStatusLEDCharacteristic;
    value = 0;
    battery = 0;

    /**
     * @type {BLE}
     */
    _ble = null;

    /**
     * @type {Runtime}
     */
    _runtime = null;

    /**
     * @type {number}
     */
    menuId = 0;

    /**
     * @type {string}
     */
    menuName = '';

    /**
     * constructor
     * @param {Runtime} runtime Scratch runtime object
     * @param {string} id extension id
     */
    constructor (runtime, id) {
        this._rateLimiter = new RateLimiter(SamLabsBLE.sendRateMax);
        this._runtime = runtime;
        this.extID = id;
        if (navigator.bluetooth) {
            this.webBLE = true;
        }
        this._runtime.on(this._runtime.constructor.PERIPHERAL_SCAN_TIMEOUT, this.discoverTimeout.bind(this));
    }

    setMenuDetails () {
        if (this.typeId === ButtonIndex) {
            this.menuId = 0;
        } else if (this.typeId === motorIndex) {
            this.menuId = 1;
        } else if (this.typeId === servoIndex) {
            this.menuId = 2;
        } else if (this.typeId === rgbIndex) {
            this.menuId = 3;
        } else if (this.typeId >= SensorBeginIndex && this.typeId <= SensorEndIndex) {
            this.menuId = 4;
        }
        let sameDevices = 1;
        this.deviceMap.forEach(value => {
            if (value.menuId === this.menuId) {
                sameDevices++;
            }
        });
        if (this.menuId === 4) {
            this.menuName = this.displayName;
        } else {
            this.menuName = String(sameDevices);
        }
    }

    async connectToDevice (deviceMap, options) {
        this.deviceMap = deviceMap;
        try {
            if (this.webBLE) {
                if (!await this.connectWebBLE(options)) {
                    return false;
                }
            } else if (!await this.connectScratchLink(options)) {
                return false;
            }
            this.statusLedBrightness = 1;
            this.lastStatusLEDValue = [100, 100, 100];
            this.writeStatusLed(new Uint8Array([255, 255, 255]));
            return true;
        } catch (error) {
            console.log(error);
            return false;
        }
    }

    async connectWebBLE (options) {
        // Request a Bluetooth device with the specified filter
        const device = await navigator.bluetooth.requestDevice(options);

        this.device = device;

        console.log('Device found:', this.device);

        this.device.addEventListener('gattserverdisconnected', () => this.onDisconnected());

        // Connect to the GATT server
        const server = await this.device.gatt.connect();
        console.log('Connected to GATT Server:', server);
        // Get the Battery Service
        const battServ = await server.getPrimaryService(SamLabsBLE.battServ);

        // Get the Battery Level Characteristic
        this.batteryLevelCharacteristic = await battServ.getCharacteristic(SamLabsBLE.batteryLevelCharacteristic);
        console.log('Found battery characteristic');
        const SAMServ = await server.getPrimaryService(SamLabsBLE.SAMServ);

        this.SAMSensorCharacteristic = null;
        this.SensorAvailable = true;

        try {
            this.SAMSensorCharacteristic = await SAMServ.getCharacteristic(SamLabsBLE.SensorCharacteristic);
            console.log('Found sensor characteristic');
        } catch (error) {
            console.log('Sensor characteristic not found');
            this.SensorAvailable = false;
        }
        this.SAMActorCharacteristic = null;
        this.ActorAvailable = true;

        try {
            this.SAMActorCharacteristic = await SAMServ.getCharacteristic(SamLabsBLE.ActorCharacteristic);
            console.log('Found actor characteristic');
        } catch (error) {
            console.log('Actor characteristic not found');
            this.ActorAvailable = false;
        }
        this.SAMBotCharacteristic = null;
        this.SAMBotAvailable = (device.name === 'SAM BabyBot');

        if (this.SAMBotAvailable) {
            try {
                this.SAMBotCharacteristic = await SAMServ.getCharacteristic(SamLabsBLE.SAMBotCommandCharacteristic);
                console.log('Found samBot characteristic');
            } catch (error) {
                console.log('samBot characteristic not found');
            }
        }

        this.SAMStatusLEDCharacteristic = await SAMServ.getCharacteristic(SamLabsBLE.StatusLedCharacteristic);
        console.log('Found statusled characteristic');

        let sameDevices = 1;
        this.deviceMap.forEach(value => {
            if (value.device.name === device.name) {
                sameDevices++;
            }
        });
        this.typeId = 0;
        for (this.typeId = 0; this.typeId < DeviceTypes.length; this.typeId++) {
            if (DeviceTypes[this.typeId].advName === device.name) {
                break;
            }
        }
        if (this.typeId === DeviceTypes.length) {
            this.typeId = 0;
        }
        this.displayName = `${DeviceTypes[this.typeId].name} ${sameDevices}`;
        this.id = device.id;
        this.deviceType = DeviceTypes[this.typeId];
        this.sameDevices = sameDevices;
        this.device = device;

        this.setMenuDetails();

        if (this.SensorAvailable && !this.SAMBotAvailable) {
            try {
                await this.SAMSensorCharacteristic.startNotifications();
                this.SAMSensorCharacteristic.addEventListener('characteristicvaluechanged',
                    this.handleSensorNotifications.bind(this));
                console.log('subscribed to sensor events');
            } catch (error) {
                console.log('Failed to subscribe to sensor events:', error);
            }
        }

        try {
            await this.batteryLevelCharacteristic.startNotifications();
            this.batteryLevelCharacteristic.addEventListener('characteristicvaluechanged',
                this.handleBattChange.bind(this));
            console.log('subscribed to battery events');
        } catch (error) {
            console.log('Failed to subscribe to battery events:', error);
        }

        console.log(`Connected to ${device.name || 'Unknown Device'}, id ${device.id}, sambot ${this.SAMBotAvailable}`);
        return true;
    }

    addStyles () {
        const style = document.createElement('style');
        style.innerHTML = `
            #device-list-container {
                position: fixed;
                top: 20%;
                left: 50%;
                transform: translate(-50%, -20%);
                background: white;
                padding: 15px;
                border-radius: 10px;
                box-shadow: 0px 4px 10px rgba(0, 0, 0, 0.3);
                width: 300px;
                max-height: 400px;
                overflow-y: auto;
                z-index: 9999; /* Ensure it appears above Scratch */
                font-family: Arial, sans-serif;
            }
    
            #device-list-container h3 {
                margin: 0;
                padding-bottom: 10px;
                text-align: center;
                border-bottom: 1px solid #ccc;
            }
    
            #device-list {
                list-style: none;
                padding: 0;
                margin: 10px 0;
            }
    
            #device-list li {
                padding: 10px;
                cursor: pointer;
                background: #f9f9f9;
                margin-bottom: 5px;
                border-radius: 5px;
                text-align: center;
                transition: background 0.2s;
            }
    
            #device-list li:hover {
                background: #ddd;
            }
    
            #close-device-list {
                display: block;
                width: 100%;
                padding: 8px;
                margin-top: 10px;
                background: #ff4d4d;
                color: white;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                text-align: center;
            }
    
            #close-device-list:hover {
                background: #cc0000;
            }
        `;
        document.head.appendChild(style);
    }

    async connectScratchLink (options) {
        try {
            if (this._ble) {
                this._ble.disconnect();
            }
            this.discoverCancelled = false;
            this._ble = new BLE(this._runtime, this.extID, options, this._onConnect.bind(this), this.reset);
            this.discovering = true;

            // Ensure styles are applied
            this.addStyles();
    
            // Create floating UI container
            let container = document.getElementById('device-list-container');
            if (!container) {
                container = document.createElement('div');
                container.id = 'device-list-container';
                container.innerHTML = `
                    <h3>Select a Device</h3>
                    <ul id="device-list"></ul>
                    <button id="close-device-list">Close</button>
                `;
                document.body.appendChild(container);
    
                document.getElementById('close-device-list').onclick = () => {
                    document.body.removeChild(container);
                    this.discovering = false; // Stop discovery when closed
                    this.discoverCancelled = true;
                };
            }
    
            await this.scanForDevices();

            if (this.discoverCancelled) {
                this._ble.disconnect();
                return false;
            }

            const device = this.device;
            console.log(device);
            
            let sameDevices = 1;
            this.deviceMap.forEach(value => {
                if (value.device.name === device.name) {
                    sameDevices++;
                }
            });
            this.typeId = 0;
            for (this.typeId = 0; this.typeId < DeviceTypes.length; this.typeId++) {
                if (DeviceTypes[this.typeId].advName === device.name) {
                    break;
                }
            }
            if (this.typeId === DeviceTypes.length) {
                this.typeId = 0;
            }
            this.displayName = `${DeviceTypes[this.typeId].name} ${sameDevices}`;
            this.id = String(device.peripheralId);
            this.deviceType = DeviceTypes[this.typeId];
            this.sameDevices = sameDevices;
            this.device = device;
            this.SAMBotAvailable = (this.device.name === 'SAM BabyBot');
            this.ActorAvailable = true;
            this.SensorAvailable = true;

            this.setMenuDetails();

            while (!this._ble.isConnected()) {
                await new Promise(resolve => setTimeout(resolve, 500)); // Non-blocking delay
            }
        } catch (e) {
            console.log(e);
        }
        return true;
    }

    _onConnect () {
        console.log('connected to device');
        this._ble.startNotifications(
            SamLabsBLE.battServ,
            SamLabsBLE.batteryLevelCharacteristic,
            this.handleBattChange.bind(this)
        );
        this._ble.startNotifications(
            SamLabsBLE.SAMServ,
            SamLabsBLE.SensorCharacteristic,
            this.handleSensorNotifications.bind(this)
        );
    }

    async scanForDevices () {
        this._runtime.on(this._runtime.constructor.PERIPHERAL_LIST_UPDATE, this.updateDeviceList.bind(this));
        while (this.discovering && !this._ble.isConnected()) {
            await new Promise(resolve => setTimeout(resolve, 100)); // Non-blocking delay
        }
    }
    
    updateDeviceList () {
        const deviceList = document.getElementById('device-list');
        if (!deviceList) return;
    
        deviceList.innerHTML = ''; // Clear existing list
    
        for (const [id, device] of Object.entries(this._ble._availablePeripherals)) {
            const item = document.createElement('li');
            item.textContent = device.name || `Unknown Device (${id})`;
            item.dataset.deviceId = id;
            item.onclick = () => this.handleDeviceSelection(id);
            deviceList.appendChild(item);
        }
    }
    
    handleDeviceSelection (deviceId) {
        console.log(`Selected device: ${deviceId}`);
        this.deviceId = deviceId;
        this.device = this._ble._availablePeripherals[deviceId];
        console.log('connecting');
        this._ble.connectPeripheral(deviceId);
        this.discovering = false;
        
        // Close UI after selection
        const container = document.getElementById('device-list-container');
        if (container) {
            document.body.removeChild(container);
        }
        console.log(this._ble.isConnected());
    }

    discoverTimeout () {
        this.discovering = false;
        this.discoverCancelled = true;
        
        const container = document.getElementById('device-list-container');
        if (container) {
            document.body.removeChild(container);
        }
    }

    /**
     * Write a message to the device with Csratch Link
     * @param {string} uuid - the UUID of the characteristic to write to
     * @param {Uint8Array} message - the message to write
     */
    async sendScratchLink (uuid, message) {
        if (!this._ble.isConnected()) return;

        await this._ble.write(
            SamLabsBLE.SAMServ,
            uuid,
            Base64Util.uint8ArrayToBase64(message),
            'base64'
        );
    }

    handleSensorNotifications (event) {
        let value;
        if (this.webBLE) {
            value = event.target.value.getUint8(0);
        } else {
            const data = Base64Util.base64ToUint8Array(event);
            value = data[0];
        }
        if (DeviceTypes[this.typeId].invertValues) {
            this.value = 100 - (value / 2.55);
        } else {
            this.value = value / 2.55;
        }
    }

    handleBattChange (event) {
        let value;
        if (this.webBLE) {
            value = event.target.value.getUint8(0);
        } else {
            const data = Base64Util.base64ToUint8Array(event);
            value = data[0];
        }
        this.battery = value;
    }

    onDisconnected () {
    }

    /**
     * send a message to the status led characteristic
     * @param {Uint8Array} msg the message
     * @param {boolean} [useLimiter=true] - if true, use the rate limiter
     */
    async writeStatusLed (msg, useLimiter = true) {
        if (useLimiter) {
            if (!this._rateLimiter.okayToSend()) return Promise.resolve();
        }
        if (this.webBLE) {
            await this.SAMStatusLEDCharacteristic.writeValue(msg);
        } else {
            await this.sendScratchLink(SamLabsBLE.StatusLedCharacteristic, msg);
        }
        return new Promise(resolve => {
            window.setTimeout(() => {
                resolve();
            }, SamLabsBLE.sendInterval);
        });
    }

    /**
     * send a message to the actor characteristic
     * @param {Uint8Array} msg the mesage
     * @param {boolean} [useLimiter=true] - if true, use the rate limiter
     */
    async writeActor (msg, useLimiter = true) {
        if (useLimiter) {
            if (!this._rateLimiter.okayToSend()) return Promise.resolve();
        }
        if (this.webBLE) {
            await this.SAMActorCharacteristic.writeValue(msg);
        } else {
            await this.sendScratchLink(SamLabsBLE.ActorCharacteristic, msg);
        }
        return new Promise(resolve => {
            window.setTimeout(() => {
                resolve();
            }, SamLabsBLE.sendInterval);
        });
    }

    /**
     * send a message to the SamBot characteristic
     * @param {Uint8Array} msg the mesage
     * @param {boolean} [useLimiter=true] - if true, use the rate limiter
     */
    async writeBot (msg, useLimiter = true) {
        if (useLimiter) {
            if (!this._rateLimiter.okayToSend()) return Promise.resolve();
        }
        if (this.webBLE) {
            await this.SAMBotCharacteristic.writeValue(msg);
        } else {
            await this.sendScratchLink(SamLabsBLE.SAMBotCommandCharacteristic, msg);
        }
        return new Promise(resolve => {
            window.setTimeout(() => {
                resolve();
            }, SamLabsBLE.sendInterval);
        });
    }
}

module.exports = {SamLabsBLE, DeviceTypes, BabyBotIndex, SAMDevice};
