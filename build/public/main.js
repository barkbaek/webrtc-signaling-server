var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
(() => {
    let name;
    let connectedUser;
    const connection = new WebSocket('ws://localhost:8888');
    const { METHOD_NAME } = require('../shared/common_types');
    connection.onopen = () => {
        console.log("Connected");
    };
    // Handle all messages through this callback
    connection.onmessage = (message) => {
        console.log("Got message", message.data);
        const data = JSON.parse(message.data);
        switch (data.type) {
            case METHOD_NAME.Login:
                onLogin(data.success);
                break;
            case METHOD_NAME.Offer:
                onOffer(data.offer, data.name);
                break;
            case METHOD_NAME.Answer:
                onAnswer(data.answer);
                break;
            case METHOD_NAME.Candidate:
                onCandidate(data.candidate);
                break;
            case METHOD_NAME.Leave:
                onLeave();
                break;
            default:
                break;
        }
    };
    connection.onerror = (err) => {
        console.log("Got error", err);
    };
    const isOpen = (connection) => { return connection.readyState === connection.OPEN; };
    // Alias for sending messages in JSON format
    const send = (message) => {
        console.log(`send message: `);
        console.dir(message);
        if (connectedUser) {
            Object.assign(message, { name: connectedUser });
        }
        if (!isOpen(connection)) {
            console.log('---- WebSocket Connection is closed state!!!');
            return;
        }
        else {
            connection.send(JSON.stringify(message));
        }
    };
    const loginPage = document.querySelector('#login-page'), usernameInput = document.querySelector('#username'), loginButton = document.querySelector('#login'), callPage = document.querySelector('#call-page'), theirUsernameInput = document.querySelector('#their-username'), callButton = document.querySelector('#call'), hangUpButton = document.querySelector('#hang-up');
    callPage.style.display = "none";
    // Login when the user clicks the button
    loginButton.addEventListener("click", (event) => {
        name = usernameInput.value;
        console.log(`loginButton click event name: ${name}`);
        if (name.length > 0) {
            send({
                type: METHOD_NAME.Login,
                name: name
            });
        }
    });
    const onLogin = (success) => {
        if (success === false) {
            alert("Login unsuccessful, please try a different name.");
        }
        else {
            loginPage.style.display = "none";
            callPage.style.display = "block";
            // Get the plumbing ready for a call
            startConnection();
        }
    };
    const yourVideo = document.querySelector('#yours'), theirVideo = document.querySelector('#theirs');
    let yourConnection, stream;
    const startConnection = () => {
        if (hasUserMedia()) {
            navigator.getUserMedia({ video: true, audio: true }, function (myStream) {
                stream = myStream;
                yourVideo.srcObject = stream;
                console.log(`startConnection()`);
                if (hasRTCPeerConnection()) {
                    setupPeerConnection(stream);
                }
                else {
                    alert("Sorry, your browser does not support WebRTC.");
                }
            }, function (error) {
                console.log(error);
            });
        }
        else {
            alert("Sorry, your browser does not support WebRTC.");
        }
    };
    const setupPeerConnection = (stream) => {
        const configuration = { 'iceServers': [
                { 'urls': 'stun:stun.services.mozilla.com' },
                { 'urls': 'stun:stun.l.google.com:19302' }
            ] };
        yourConnection = new RTCPeerConnection(configuration);
        console.log(`setupPeerConnection()`);
        // Setup stream listening
        stream.getTracks().forEach((track) => {
            console.log("yourConnection.addTrack!");
            yourConnection.addTrack(track, stream);
        });
        yourConnection.ontrack = (event) => {
            console.log(`yourConnection.ontrack()`);
            theirVideo.srcObject = event.streams[0];
        };
        // Setup ice handling
        yourConnection.onicecandidate = (event) => {
            console.log(`yourConnection.onicecandidate`);
            if (event.candidate) {
                send({
                    type: METHOD_NAME.Candidate,
                    candidate: event.candidate
                });
            }
        };
    };
    const hasUserMedia = () => {
        navigator.getUserMedia = navigator.getUserMedia;
        return !!navigator.getUserMedia;
    };
    const hasRTCPeerConnection = () => {
        window.RTCPeerConnection = window.RTCPeerConnection;
        window.RTCSessionDescription = window.RTCSessionDescription;
        window.RTCIceCandidate = window.RTCIceCandidate;
        return !!window.RTCPeerConnection;
    };
    callButton.addEventListener("click", () => {
        const theirUsername = theirUsernameInput.value;
        console.log(`callButton.addEventListener()`);
        if (theirUsername.length > 0) {
            startPeerConnection(theirUsername);
        }
    });
    const startPeerConnection = (user) => __awaiter(this, void 0, void 0, function* () {
        connectedUser = user;
        console.log(`startPeerConnection()`);
        const offer = yield yourConnection.createOffer();
        console.log(`yourConnection.createOffer()`);
        send({
            type: METHOD_NAME.Offer,
            offer: offer
        });
        yourConnection.setLocalDescription(offer);
        console.log(`yourConnection.setLocalDescription() - this is from yourConnection.createOffer()`);
    });
    const onOffer = (offer, name) => __awaiter(this, void 0, void 0, function* () {
        console.log(`onOffer()`);
        connectedUser = name;
        yourConnection.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = yield yourConnection.createAnswer();
        console.log(`yourConnection.createAnswer(), yourConnection.setLocalDescription()`);
        yourConnection.setLocalDescription(answer);
        send({
            type: METHOD_NAME.Answer,
            answer: answer
        });
    });
    const onAnswer = (answer) => {
        console.log(`onAnswer() - yourConnection.setRemoteDescription()`);
        yourConnection.setRemoteDescription(new RTCSessionDescription(answer));
    };
    const onCandidate = (candidate) => {
        console.log(`onCandidate() - yourConnection.addIceCandidate()`);
        yourConnection.addIceCandidate(new RTCIceCandidate(candidate));
    };
    hangUpButton.addEventListener("click", () => {
        console.log(`hangUpButton.addEventListener - leave`);
        send({
            type: METHOD_NAME.Leave
        });
        onLeave();
    });
    const onLeave = () => {
        console.log(`onLeave()`);
        connectedUser = null;
        theirVideo.srcObject = null;
        yourConnection.close();
        yourConnection.onicecandidate = null;
        yourConnection.ontrack = null;
        setupPeerConnection(stream);
    };
})();
//# sourceMappingURL=main.js.map