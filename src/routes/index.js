// We only need to import the modules necessary for initial render
import CoreLayout from '../layouts/CoreLayout/CoreLayout'

import Home from './Home'

export const createRoutes = store => ({
	component: CoreLayout,
	path: '/',
	indexRoute: Home
});

export default createRoutes
