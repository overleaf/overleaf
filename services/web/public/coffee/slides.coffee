require [
	"libs/jquery.slides.min"
], () ->
	$('#slides').slidesjs({
		width: 940,
		height: 100,
		play: {
			active: false,
			auto: true,
			interval: 5000
		},
		navigation: {
			active: false
		},
		pagination: {
			active: false
		}
	})

