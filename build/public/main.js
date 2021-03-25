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
    connection.onopen = () => {
        console.log("Connected");
    };
    // Handle all messages through this callback
    connection.onmessage = (message) => {
        console.log("Got message", message.data);
        const data = JSON.parse(message.data);
        switch (data.type) {
            case "login":
                onLogin(data.success);
                break;
            case "offer":
                onOffer(data.offer, data.name);
                break;
            case "answer":
                onAnswer(data.answer);
                break;
            case "candidate":
                onCandidate(data.candidate);
                break;
            case "leave":
                onLeave();
                break;
            default:
                break;
        }
    };
    connection.onerror = (err) => {
        console.log("Got error", err);
    };
    // Alias for sending messages in JSON format
    const send = (message) => {
        console.log(`send message: `);
        console.dir(message);
        if (connectedUser) {
            Object.assign(message, { name: connectedUser });
        }
        connection.send(JSON.stringify(message));
    };
    const loginPage = document.querySelector('#login-page'), usernameInput = document.querySelector('#username'), loginButton = document.querySelector('#login'), callPage = document.querySelector('#call-page'), theirUsernameInput = document.querySelector('#their-username'), callButton = document.querySelector('#call'), hangUpButton = document.querySelector('#hang-up');
    callPage.style.display = "none";
    // Login when the user clicks the button
    loginButton.addEventListener("click", (event) => {
        name = usernameInput.value;
        console.log(`loginButton click event name: ${name}`);
        if (name.length > 0) {
            send({
                type: "login",
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
                    type: "candidate",
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
            type: "offer",
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
            type: "answer",
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
            type: "leave"
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