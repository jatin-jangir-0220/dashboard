import React, { Component } from 'react';
import { NavLink, RouteComponentProps } from 'react-router-dom';
import { URLS } from '../../../config';
import { ReactComponent as Documentation } from '../../../assets/icons/ic-document.svg'
import { getLoginInfo } from '../index';
import { getRandomColor } from '../helpers/Helpers';
import NavSprite from '../../../assets/icons/navigation-sprite.svg';
import TextLogo from '../../../assets/icons/ic-nav-devtron.svg';
import TagManager from 'react-gtm-module';
import ReactDOM from 'react-dom';
import './logout.css';

const navigationList = [
	{
		title: 'Applications',
		iconClass: 'nav-short-apps',
		href: URLS.APP,
	},
	{
		title: 'Charts',
		iconClass: 'nav-short-helm',
		href: URLS.CHARTS,
	},
	{
		title: 'Deployment Groups',
		iconClass: 'nav-short-bulk-actions',
		href: URLS.DEPLOYMENT_GROUPS,
	},
	{
		title: 'Security',
		href: URLS.SECURITY,
		iconClass: 'nav-security',
	},
	{
		title: 'Global Configurations',
		href: `${URLS.GLOBAL_CONFIG}`,
		iconClass: 'nav-short-global'
	},
];

export default class VerticalNav extends Component<RouteComponentProps<{}>, { loginInfo: any; showLogoutCard: boolean; }> {

	constructor(props) {
		super(props);
		this.state = {
			loginInfo: getLoginInfo(),
			showLogoutCard: false,
		}
		this.deleteCookie = this.deleteCookie.bind(this);
		this.toggleLogoutCard = this.toggleLogoutCard.bind(this);
	}

	componentDidMount() {
		if(process.env.NODE_ENV === 'production' && window._env_ && window._env_.GTM_ID) {
			const tagManagerArgs = {
				gtmId: window._env_.GTM_ID
			}
			TagManager.initialize(tagManagerArgs)
		}
	}

	toggleLogoutCard() {
		this.setState({ showLogoutCard: !this.state.showLogoutCard })
	}

	deleteCookie(): void {
		document.cookie = `argocd.token=; expires=Thu, 01-Jan-1970 00:00:01 GMT;path=/`;
		this.props.history.push('/login');
	}

	renderLogout() {
		let email: string = this.state.loginInfo ? this.state.loginInfo['email'] || this.state.loginInfo['sub'] : "";
		return ReactDOM.createPortal(<div className="transparent-div" onClick={this.toggleLogoutCard}>
			<div className="logout-card">
				<div className="flexbox flex-justify p-16">
					<div className="logout-card-user ">
						<p className="logout-card__name ellipsis-right">{email}</p>
						<p className="logout-card__email ellipsis-right">{email}</p>
					</div>
					<p className="logout-card__initial mb-0" style={{ backgroundColor: getRandomColor(email) }}>{email[0]}</p>
				</div>
				<div className="logout-card__logout cursor" onClick={this.deleteCookie}>Logout</div>
			</div>
		</div>, document.getElementById('root'))
	}

	render() {
		let email: string = this.state.loginInfo ? this.state.loginInfo['email'] || this.state.loginInfo['sub'] : "";
		return <nav>
			<aside className="short-nav main-nav">
				<NavLink to={URLS.APP} className="flex">
					<svg className="short-nav-icon logo" viewBox="0 0 40 40">
						<use href={`${NavSprite}#nav-short-devtron-logo`}></use>
					</svg>
				</NavLink>
				{navigationList.map((item, index) =>
					<NavLink to={item.href} key={index} className="flex" activeClassName="active-nav">
						<div className="svg-container flex">
							<svg className="short-nav-icon" viewBox="0 0 24 24">
								<use href={`${NavSprite}#${item.iconClass}`}></use>
							</svg>
						</div>
					</NavLink>
				)}
				<div className="flex bottom column bottom-nav">
					<a rel="noreferrer noopener" className="flex icon-dim-40 mb-16 br-8" href="https://docs.devtron.ai/" target="_blank"><Documentation className="icon-dim-24 fcn-0 cursor" /></a>
					<div className="logout-card__initial logout-card__initial--nav mb-16" onClick={this.toggleLogoutCard} style={{ backgroundColor: getRandomColor(email) }}>
						{email[0]}
					</div>
					{this.state.showLogoutCard ? this.renderLogout() : null}
					<div className="hubspot-placeholder"></div>
				</div>
			</aside>
			<aside className="expanded-nav main-nav">
				<NavLink to={URLS.APP} className="flex left">
					<img src={TextLogo} alt="devtron" className="text-logo" />
				</NavLink>
				{navigationList.map((item, index) =>
					<NavLink to={item.href} key={index} className="flex left" activeClassName="active-nav">
						<div className="title-container flex left">
							{item.title}
						</div>
					</NavLink>
				)}
				<div className="flex left bottom column bottom-nav">
					<a rel="noreferrer noopener" className="flex left icon-dim-40 mb-16 title-container" href="https://docs.devtron.ai/" target="_blank">Documentation</a>
					<button type="button" className="transparent mb-16 ellipsis-right title-container" onClick={this.toggleLogoutCard}>{email}</button>
					<div className="hubspot-placeholder"></div>
				</div>
			</aside>
		</nav>
	}
}