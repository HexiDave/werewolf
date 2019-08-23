import React from 'react'
import moment from 'moment'
import cx from 'classnames'

import './HomeView.less'

const WS_PATH = `${__API_HOST__}`;
const START_MESSAGE = '@START';
const STOP_MESSAGE = '@STOP';
const KEEP_ALIVE_MESSAGE = '@KEEP_ALIVE';
const START_TIMER_MESSAGE = '@START_TIMER';
const CHANGE_OPTION_MESSAGE = '@CHANGE_OPTION';
const ROLE_STATES_MESSAGE = '@ROLE_STATES';
const ACTIVITY_PAUSE = 5000; // milliseconds
const NEXT_MESSAGE_PAUSE = 1000; // milliseconds
const KEEP_ALIVE_TIME = 30 * 1000; // milliseconds
const ANNOUNCEMENT = 'announcement';
const DEFAULT_TIMER_LENGTH = 5 * 60;

const MALE_PREFIX = 'en_male_';
const WAKE_UP_POSTFIX = '_wake';
const CLOSE_EYES_POSTFIX = '_close';

// Werewolves
// Minion
// Masons
// Seer
// Robber
// Troublemaker
// Drunk
// Insomniac

const _role = (properName, priority) => ({
	properName,
	priority
});

const ROLES = {
	loneWolf: _role('Lone Wolf', -1),
	sentinel: _role('Sentinel', 0),
	werewolf: _role('Werewolf', 1),
	alphaWolf: _role('Alpha Wolf', 1.1),
	mysticWolf: _role('Mystic Wolf', 1.2),
	minion: _role('Minion', 2),
	mason: _role('Masons', 3),
	seer: _role('Seer', 4),
	appSeer: _role('Apprentice Seer', 4.1),
	pi: _role('Paranormal Investigator', 5),
	robber: _role('Robber', 6),
	witch: _role('Witch', 7),
	troublemaker: _role('Troublemaker', 8),
	vIdiot: _role('Village Idiot', 9),
	drunk: _role('Drunk', 10),
	insomniac: _role('Insomniac', 11),
	revealer: _role('Revealer', 12),
	curator: _role('Curator', 13)
};

const INITIAL_ROLE_STATES = Object.keys(ROLES).reduce((prev, cur) => ({
	...prev,
	[cur]: false
}), {});

const audioPath = name => name ? `audio/${name.toLowerCase()}.ogg` : '';

const imagePath = name => name ? `images/${name}.jpg` : '';

const roleAudioPath = (role, wakeUp = true, voice = MALE_PREFIX) =>
	audioPath(`${voice}${role}${wakeUp ? WAKE_UP_POSTFIX : CLOSE_EYES_POSTFIX}`);

const _msg = (role, wakeUp, voice = MALE_PREFIX, delay) => ({
	audio: roleAudioPath(role, wakeUp, voice),
	role,
	wakeUp,
	delay
});

const makeRoleMessages = (role, loneWolf = false, voice = MALE_PREFIX) => {
	const isLoneWolfRole = role === 'werewolf' && loneWolf;

	const wakeUp = _msg(role, true, voice, isLoneWolfRole ? 100 : ACTIVITY_PAUSE);
	const closeEyes = _msg(role, false, voice, NEXT_MESSAGE_PAUSE);

	if (isLoneWolfRole) {
		return [
			wakeUp,
			{
				role,
				loneWolf,
				audio: audioPath(`${voice}werewolf_lonewolf_option`),
				delay: ACTIVITY_PAUSE
			},
			closeEyes
		]
	}

	return [
		wakeUp,
		closeEyes
	]
};

class HomeView extends React.Component {

	state = {
		messages: [],
		roles: {...INITIAL_ROLE_STATES},
		timerEndMoment: null,
		timeLeft: null,
		connected: false,
		connectionPath: WS_PATH,
		gameTime: 5
	};

	componentDidMount() {
		this.volume = 50;

		this.refs[ANNOUNCEMENT].addEventListener('ended', ::this.messageEnded, false);

		this.connectToHost();
	}

	componentWillUnmount() {
		if (this.timer) {
			clearInterval(this.timer);
		}

		this.disconnectFromHost();
	}

	messageEnded() {
		const {messages} = this.state;

		const nextMessage = messages[0];

		const {final, delay} = nextMessage;

		const remaining = messages.slice(1);

		this.setState({messages: remaining});

		if (remaining.length && !final) {
			this.play(ANNOUNCEMENT, delay);
		} else if (!final) {
			this.sendStartTimerMessage();
		}
	}

	removeKeepAliveTimer() {
		if (this.keepAliveTimer) {
			clearInterval(this.keepAliveTimer);
			this.keepAliveTimer = undefined;
		}
	}

	disconnectFromHost() {
		if (this.ws) {
			this.removeKeepAliveTimer();

			this.ws.onclose = undefined;
			this.ws.close();
			this.ws = null;
			this.setState({connected: false});
		}
	}

	connectToHost() {
		this.disconnectFromHost();

		this.ws = new WebSocket(this.state.connectionPath);
		this.ws.onmessage = ::this.receivedMessage;
		this.ws.onclose = ::this.handleConnectionClosed;
		this.ws.onopen = ::this.handleConnectionOpened;
	}

	handleConnectionClosed() {
		this.removeKeepAliveTimer();
		this.setState({connected: false});
	}

	handleConnectionOpened = () => {
		this.keepAliveTimer = setInterval(() => {
			this.sendKeepAliveTimer();
		}, KEEP_ALIVE_TIME);

		this.setState({connected: true});
	}

	receivedMessage = ({data}) => {
		const parsed = JSON.parse(data);

		switch (parsed.msg) {
			case START_MESSAGE:
				this.startRound(parsed.messages);
				break;
			case STOP_MESSAGE:
				this.reset();
				break;
			case CHANGE_OPTION_MESSAGE:
				const {role, checked} = parsed;

				this.setState({
					roles: {
						...this.state.roles,
						[role]: checked
					}
				});
				break;
			case ROLE_STATES_MESSAGE:
				this.setState({
					roles: {
						...this.state.roles,
						...parsed.roles
					}
				});
				break;
			case START_TIMER_MESSAGE:
				const {gameTime} = parsed;

				this.setState({gameTime, timerEndMoment: moment().add({seconds: gameTime * 60})});
				this.timer = setInterval(() => {
					const {timerEndMoment} = this.state;

					if (timerEndMoment) {
						const now = moment();
						const timeLeft = timerEndMoment.diff(now, 'seconds');
						this.setState({timeLeft});

						if (now.isSameOrAfter(timerEndMoment)) {
							this.stopTimer();
							if (this.state.messages.length === 0) {
								// Play 3-2-1
								this.setState({
									messages: [
										{
											audio: audioPath('en_male_everyone_timeisup_321vote'),
											delay: 0,
											final: true
										}
									]
								});

								this.play(ANNOUNCEMENT, 0);
							}
						}
					}

				}, 1000);
				break;
			default:
				break;
		}
	}

	stopTimer() {
		clearInterval(this.timer);
		this.setState({timerEndMoment: null, timeLeft: null});
	}

	reset() {
		this.stop(ANNOUNCEMENT);
		this.stopTimer();
		this.setState({messages: []});
	}

	startRound(messages) {
		this.stop();
		this.stopTimer();
		this.setState({messages});
		this.play(ANNOUNCEMENT, 500);
	}

	sendJSON(data) {
		this.ws.send(JSON.stringify(data));
	}

	sendStart() {
		const messages = this.buildMessages();

		this.sendJSON({
			msg: START_MESSAGE,
			messages,
			gameTime: this.state.gameTime
		});
	}

	sendStop() {
		this.sendJSON({
			msg: STOP_MESSAGE
		});
	}

	sendChangeOption(role, checked) {
		this.sendJSON({
			msg: CHANGE_OPTION_MESSAGE,
			role,
			checked
		})
	}

	sendStartTimerMessage() {
		this.sendJSON({
			msg: START_TIMER_MESSAGE
		})
	}

	sendKeepAliveTimer() {
		this.sendJSON({
			msg: KEEP_ALIVE_MESSAGE
		})
	}

	stop(refName = ANNOUNCEMENT) {
		const audio = this.refs[refName];

		setTimeout(() => {
			audio.pause();
		}, 0);
	}

	play = (refName = ANNOUNCEMENT, pause = 0) => {
		const audio = this.refs[refName];

		setTimeout(() => {
			try {
				audio.load();
				audio.volume = this.volume * 0.01;
				audio.play();
			} catch (e) {
				// Swallow it, who cares
			}
		}, pause);
	}

	toggleRole(role) {
		const {roles} = this.state;
		const checked = !roles[role];

		this.setState({
			roles: {
				...roles,
				[role]: checked
			}
		});

		this.sendChangeOption(role, checked);
	}

	handleRoleToggle(e) {
		this.toggleRole(e.target.name);
	}

	handleRoleImageToggle(e) {
		this.toggleRole(e.target.id);
	}

	handleVolumeChange(e) {
		this.volume = e.target.value;

		this.refs[ANNOUNCEMENT].volume = this.volume * 0.01;
	}

	handleGameTimeChange(e) {
		this.setState({gameTime: parseInt(e.target.value)});
	}

	handleConnectionPathChanged(e) {
		this.disconnectFromHost();

		this.setState({connectionPath: e.target.value});
	}

	buildMessages() {
		const {roles} = this.state;

		const {loneWolf, ...mainRoles} = roles;

		if (mainRoles.length === 0) {
			this.setState({messages: []});

			return;
		}

		const messageList = Object.keys(mainRoles)
		.reduce((prev, cur) => mainRoles[cur] ? [...prev, cur] : prev, [])
		.sort((a, b) => ROLES[a].priority - ROLES[b].priority)
		.map(role => makeRoleMessages(role, loneWolf))
		.reduce((prev, cur) => [...prev, ...cur], []);

		return [
			_msg('everyone', false, MALE_PREFIX, NEXT_MESSAGE_PAUSE),
			...messageList,
			_msg('everyone', true, MALE_PREFIX, NEXT_MESSAGE_PAUSE)
		];
	}

	renderTimeLeft(timeLeft) {
		const duration = moment.duration(timeLeft, 'seconds');
		const minutes = duration.minutes();
		const seconds = duration.seconds();

		return (
			<div className='timer'>{minutes}:{('0' + seconds).substr(-2)}</div>
		)
	}

	render() {

		const {messages, roles, connected, timerEndMoment, timeLeft, connectionPath, gameTime} = this.state;

		const currentMessage = messages.length ? messages[0].audio : null;

		return (
			<div>
				<input type='password' size={64} value={connectionPath} onChange={::this.handleConnectionPathChanged}/>

				{' '}

				<button type='button' disabled={connected} onClick={::this.connectToHost}>
					connect
				</button>

				{' '}

				{connected ? 'Connected' : 'Disconnected'}

				<hr />

				<div className='roles'>
					{Object.keys(roles).map(role => (
						<img
							className={cx('image', {selected: roles[role]})}
							key={role}
							id={role}
							onClick={::this.handleRoleImageToggle}
							src={imagePath(role)}
						/>
					))}
				</div>

				<hr />

				<div className='controls'>
					<div className='row'>

						<button type='button' onClick={::this.sendStart}>
							Start
						</button>

						<div className='field'>
							<label>Game length: {gameTime} {gameTime === 1 ? 'minute' : 'minutes'}</label>
							<input
								type='range'
								min={1}
								max={10}
								value={gameTime}
								onChange={::this.handleGameTimeChange}
							/>
						</div>
					</div>

					<div className='row'>
						<button type='button' onClick={::this.sendStop}>
							Stop
						</button>

						<div className='field'>
							<label>Volume</label>
							<input type='range' defaultValue={50} onChange={::this.handleVolumeChange}/>
						</div>
					</div>
				</div>

				<hr />

				{
					timerEndMoment && timeLeft && this.renderTimeLeft(timeLeft)
				}

				<audio ref={ANNOUNCEMENT} src={currentMessage}/>
			</div>
		)
	}
}

export default HomeView;