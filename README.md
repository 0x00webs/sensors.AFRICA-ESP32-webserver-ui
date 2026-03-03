# sensors.AFRICA-ESP32-webserver-ui

Web server user interface development for ESP32 boards. This repository intends to separate core firmware development and web development that use distinct frameworks and build processes for a smoother development experience.

Initial commit files forked from [sensors.AFRICA-ESP32-Quectel-Firmware](https://github.com/CodeForAfrica/sensors.AFRICA-ESP32-Quectel-Firmware.git) repository.

## [Development Workflow](https://github.com/CodeForAfrica/sensors.AFRICA-ESP32-webserver-ui/tree/development)

### Prerequisites

- [Node.js (v20 or later)](https://nodejs.org/en/download/) installed on your machine.
  - npm (Node Package Manager) comes bundled with Node.js and will be used to manage dependencies and run scripts.

### Setup
1. Clone the repository and navigate to the project directory:
	 ```bash
	 git clone https://github.com/CodeForAfrica/sensors.AFRICA-ESP32-webserver-ui.git
	 cd sensors.AFRICA-ESP32-webserver-ui

2. Switch to the development branch
	 ```bash
	 git checkout development
	 ```

3. Install the project dependencies:
	 ```bash
	 npm install
	 ```

4. Running the Development Server
	To start the development server with hot-reloading, run:
	```bash
	npm run dev
	```
