import React, {Component, PropTypes} from 'react'
import {Router} from 'react-router'
import {Provider} from 'react-redux'
import './AppContainer.less'

class AppContainer extends Component {
	static propTypes = {
		history: PropTypes.object.isRequired,
		routes: PropTypes.oneOfType([
			PropTypes.object,
			PropTypes.arrayOf(PropTypes.object)
		]).isRequired,
		store: PropTypes.object.isRequired
	};

	render() {
		const {history, routes, store} = this.props;

		return (
			<Provider store={store}>
				<Router history={history} children={routes}/>
			</Provider>
		)
	}
}

export default AppContainer
