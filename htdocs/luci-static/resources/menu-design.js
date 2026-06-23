'use strict';
'require baseclass';
'require ui';

// 兼容新旧版本 LuCI
var LuciCompat = {
	isNewVersion: function() {
		return L.env.luci_version && parseFloat(L.env.luci_version.split('.')[0]) >= 23;
	}
};

return baseclass.extend({
	__init__: function() {
		this.applyDesignConfig();
		ui.menu.load().then(L.bind(this.render, this));
	},

	applyDesignConfig: function() {
		var self = this;
		fetch('/luci-static/design/config.json?_=' + Date.now())
			.then(function(r) { return r.ok ? r.json() : null; })
			.catch(function() { return null; })
			.then(function(cfg) {
				if (!cfg) return;
				var body = document.body;
				var root = document.documentElement;

				if (cfg.mode === 'dark') {
					body.classList.add('design-dark');
					body.classList.remove('design-light');
				} else if (cfg.mode === 'light') {
					body.classList.add('design-light');
					body.classList.remove('design-dark');
				}

				var navbar = document.querySelector('.navbar');
				if (navbar) {
					navbar.style.display = (cfg.navbar === 'close') ? 'none' : '';
				}

				if (cfg.navbar_proxy) {
					var proxyLinks = document.querySelectorAll('.navbar a[href*="/services/"]');
					proxyLinks.forEach(function(a) {
						a.href = a.href.replace(/\/services\/[^/]+/, '/services/' + cfg.navbar_proxy);
						var img = a.querySelector('img');
						if (img) img.src = img.src.replace(/\/images\/[^/]+\.png/, '/images/' + cfg.navbar_proxy + '.png');
					});
				}

				if (cfg.accent_color && /^#[0-9a-fA-F]{3,6}$/.test(cfg.accent_color)) {
					root.style.setProperty('--active_color', cfg.accent_color);
					root.style.setProperty('--progressbar', cfg.accent_color);
				}

				if (cfg.bg_color && /^#[0-9a-fA-F]{3,6}$/.test(cfg.bg_color)) {
					root.style.setProperty('--bg', cfg.bg_color);
				}

				if (cfg.header_color && /^#[0-9a-fA-F]{3,6}$/.test(cfg.header_color)) {
					root.style.setProperty('--header_bg_color', cfg.header_color);
				}

				if (cfg.sidebar_color && /^#[0-9a-fA-F]{3,6}$/.test(cfg.sidebar_color)) {
					root.style.setProperty('--sidebar_bg_color', cfg.sidebar_color);
					root.style.setProperty('--mainleftbg_color', cfg.sidebar_color);
				}

				if (cfg.card_color && /^#[0-9a-fA-F]{3,6}$/.test(cfg.card_color)) {
					root.style.setProperty('--sectionbg_color', cfg.card_color);
					root.style.setProperty('--sectionbg_color2', cfg.card_color);
					root.style.setProperty('--card_bg_color', cfg.card_color);
				}

				var mode = cfg.wallpaper_mode || '';
				if (mode === 'bing_daily' || mode === 'bing_random') {
					self.applyBingWallpaper(cfg, root, body);
				} else if (cfg.wallpaper_url && /^(https?:\/\/|\/)/.test(cfg.wallpaper_url)) {
					self.setWallpaper(cfg.wallpaper_url, root, body);
				}
			});
	},

	render: function(tree) {
		var node = tree,
		    url = '';

		this.renderModeMenu(node);

		// 兼容新旧版本的 dispatchpath
		var dispatchpath = L.env.dispatchpath || [];
		if (dispatchpath.length >= 3) {
			for (var i = 0; i < 3 && node; i++) {
				node = node.children[dispatchpath[i]];
				url = url + (url ? '/' : '') + dispatchpath[i];
			}

			if (node)
				this.renderTabMenu(node, url);
		}

		var showSideBtn = document.querySelector('.showSide');
		var darkMask = document.querySelector('.darkMask');
		
		if (showSideBtn)
			showSideBtn.addEventListener('click', ui.createHandlerFn(this, 'handleSidebarToggle'));

		if (darkMask)
			darkMask.addEventListener('click', ui.createHandlerFn(this, 'handleSidebarToggle'));
		
		var loadingEl = document.querySelector(".main > .loading");
		if (loadingEl) {
			loadingEl.style.opacity = '0';
			loadingEl.style.visibility = 'hidden';
		}

		if (window.innerWidth <= 992) {
			var mainLeft = document.querySelector('.main-left');
			if (mainLeft)
				mainLeft.style.width = '0';
		}

		var mainRight = document.querySelector('.main-right');
		if (mainRight)
			mainRight.style.overflow = 'auto';
			
		window.addEventListener('resize', this.handleSidebarToggle, true);
	},

	handleMenuExpand: function(ev) {
		var a = ev.target, slide = a.parentNode, slide_menu = a.nextElementSibling;
		var collapse = false;

		document.querySelectorAll('.main .main-left .nav > li >ul.active').forEach(function (ul) {
			// 兼容无 jQuery 环境
			if (typeof $ !== 'undefined' && $.fn && $.fn.slideUp) {
				$(ul).stop(true).slideUp("fast", function () {
					ul.classList.remove('active');
					if (ul.previousElementSibling)
						ul.previousElementSibling.classList.remove('active');
				});
			} else {
				ul.style.display = 'none';
				ul.classList.remove('active');
				if (ul.previousElementSibling)
					ul.previousElementSibling.classList.remove('active');
			}
			
			if (!collapse && ul === slide_menu) {
				collapse = true;
			}
		});

		if (!slide_menu)
			return;
		
		if (!collapse) {
			if (typeof $ !== 'undefined' && $.fn && $.fn.slideDown) {
				$(slide).find(".slide-menu").slideDown("fast", function(){
					slide_menu.classList.add('active');
					a.classList.add('active');
				});
			} else {
				var slideMenus = slide.querySelectorAll('.slide-menu');
				slideMenus.forEach(function(menu) {
					menu.style.display = 'block';
				});
				slide_menu.classList.add('active');
				a.classList.add('active');
			}
			a.blur();
		}
		ev.preventDefault();
		ev.stopPropagation();
	},

	renderMainMenu: function(tree, url, level) {
		var l = (level || 0) + 1,
		    ul = E('ul', { 'class': level ? 'slide-menu' : 'nav' }),
		    children = ui.menu.getChildren(tree);

		if (children.length == 0 || l > 2)
			return E([]);
		for (var i = 0; i < children.length; i++) {
			var isActive = ((L.env.dispatchpath[l] == children[i].name) && (L.env.dispatchpath[l - 1] == tree.name)),
				submenu = this.renderMainMenu(children[i], url + '/' + children[i].name, l),
				hasChildren = submenu.children.length,
				slideClass = hasChildren ? 'slide' : null,
				menuClass = hasChildren ? 'menu' : null;
			if (isActive) {
				ul.classList.add('active');
				slideClass += " active";
				menuClass += " active";
			}

			ul.appendChild(E('li', { 'class': slideClass }, [
				E('a', {
					'href': L.url(url, children[i].name),
					'click': (l == 1) ? ui.createHandlerFn(this, 'handleMenuExpand') : null,
					'class': menuClass,
					'data-title': hasChildren ? children[i].title.replace(" ", "_") : children[i].title.replace(" ", "_"),
				}, [_(children[i].title)]),
				submenu
			]));
		}

		if (l == 1) {
			var container = document.querySelector('#mainmenu');

			container.appendChild(ul);
			container.style.display = '';
		}

		return ul;
	},

	renderModeMenu: function(tree) {
		var ul = document.querySelector('#modemenu');
		if (!ul) return;
		
		var children = ui.menu.getChildren(tree);

		// 兼容新旧版本的 requestpath
		var requestpath = L.env.requestpath || [];
		
		for (var i = 0; i < children.length; i++) {
			var isActive = (requestpath.length ? children[i].name == requestpath[0] : i == 0);

			ul.appendChild(E('li', {}, [
				E('a', {
					'href': L.url(children[i].name),
					'class': isActive ? 'active' : null
				}, [ _(children[i].title) ])
			]));

			if (isActive)
				this.renderMainMenu(children[i], children[i].name);

			if (i > 0 && i < children.length)
				ul.appendChild(E('li', {'class': 'divider'}, [E('span')]))
		}

		if (children.length > 1 && ul.parentElement)
			ul.parentElement.style.display = '';
	},

	renderTabMenu: function(tree, url, level) {
		var container = document.querySelector('#tabmenu'),
			l = (level || 0) + 1,
			ul = E('ul', { 'class': 'tabs' }),
			children = ui.menu.getChildren(tree),
			activeNode = null;

		if (children.length == 0)
			return E([]);

		for (var i = 0; i < children.length; i++) {
			var isActive = (L.env.dispatchpath[l + 2] == children[i].name),
				activeClass = isActive ? ' active' : '',
				className = 'tabmenu-item-%s %s'.format(children[i].name, activeClass);

			ul.appendChild(E('li', { 'class': className }, [
				E('a', { 'href': L.url(url, children[i].name) }, [_(children[i].title)])
			]));

			if (isActive)
				activeNode = children[i];
		}

		container.appendChild(ul);
		container.style.display = '';

		if (activeNode)
			container.appendChild(this.renderTabMenu(activeNode, url + '/' + activeNode.name, l));

		return ul;
	},

	setWallpaper: function(url, root, body) {
		if (!url || !/^(https?:\/\/|\/)/.test(url)) return;
		root.style.setProperty('--bg-image', "url('" + url + "')");
		body.classList.add('design-wallpaper');
	},

	applyBingWallpaper: function(cfg, root, body) {
		var self = this;
		var isRandom = cfg.wallpaper_mode === 'bing_random';
		var cacheKey = 'design_bing_' + (isRandom ? 'random' : 'daily');
		var cacheTimeKey = cacheKey + '_ts';
		var interval = parseInt(cfg.wallpaper_interval || '0', 10) * 3600 * 1000;
		var cached = localStorage.getItem(cacheKey);
		var cachedTs = parseInt(localStorage.getItem(cacheTimeKey) || '0', 10);
		var now = Date.now();

		if (cached && (!interval || (now - cachedTs) < interval)) {
			self.setWallpaper(cached, root, body);
			return;
		}

		fetch('https://bing.com/HPImageArchive.aspx?format=js&idx=0&n=30&mkt=zh-CN')
			.then(function(r) { return r.json(); })
			.then(function(data) {
				if (!data.images || !data.images.length) return;
				var img = isRandom
					? data.images[Math.floor(Math.random() * data.images.length)]
					: data.images[0];
				var url = img.urlbase
					? 'https://bing.com' + img.urlbase + '_1920x1080.jpg'
					: 'https://bing.com' + img.url.replace(/_UHD(.\w+)/, '_1920x1080$1').split('&rf=')[0];
				localStorage.setItem(cacheKey, url);
				localStorage.setItem(cacheTimeKey, String(now));
				self.setWallpaper(url, root, body);
			})
			.catch(function() {
				if (cached) self.setWallpaper(cached, root, body);
			});

		if (interval > 0) {
			setInterval(function() {
				localStorage.removeItem(cacheTimeKey);
				self.applyBingWallpaper(cfg, root, body);
			}, interval);
		}
	},

	handleSidebarToggle: function(ev) {
		var width = window.innerWidth,
		    darkMask = document.querySelector('.darkMask'),
		    mainRight = document.querySelector('.main-right'),
		    mainLeft = document.querySelector('.main-left'),
		    open = mainLeft.style.width == '';

			if (width > 992 || ev.type == 'resize')
				open = true;
				
		darkMask.style.visibility = open ? '' : 'visible';
		darkMask.style.opacity = open ? '': 1;

		if (width <= 992)
			mainLeft.style.width = open ? '0' : '';
		else
			mainLeft.style.width = ''

		// 初始化设置，css后置设置导致刷新会闪现。
		mainLeft.style.transition = 'visibility 2000ms, width 200ms';
		mainLeft.style.visibility = open ? '' : 'visible';

		mainRight.style['overflow-y'] = open ? 'auto' : 'visible';

		var header = document.querySelector("header");
		if (header) {
			if (typeof $ !== 'undefined' && $.fn && $.fn.css) {
				$("header").css("box-shadow", open ? "0 2px 4px rgb(0 0 0 / 8%)" : "17rem 2px 4px rgb(0 0 0 / 8%)");
			} else {
				header.style.boxShadow = open ? "0 2px 4px rgb(0 0 0 / 8%)" : "17rem 2px 4px rgb(0 0 0 / 8%)";
			}
		}
	},
});

