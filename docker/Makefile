all:

image:
	docker build -t $(registry)/warframe-patchlogs -f Dockerfile .
	docker push $(registry)/warframe-patchlogs

armhf:
	docker build -t $(registry)/warframe-patchlogs:armhf -f Dockerfile.armhf .
	docker push $(registry)/warframe-patchlogs
