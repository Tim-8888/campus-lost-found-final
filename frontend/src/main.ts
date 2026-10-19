import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap'
import './styles/global.css'
import './styles/layout.css'
import './styles/components.css'
import './styles/pages.css'
import { route } from './router'

window.addEventListener('hashchange', () => void route())
window.addEventListener('DOMContentLoaded', () => void route())
