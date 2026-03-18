FROM alpine:3.21

RUN apk add --no-cache curl

COPY crontab /etc/crontabs/root
COPY scripts/ /scripts/
RUN chmod +x /scripts/*.sh && mkdir -p /var/log/cron

CMD ["crond", "-f", "-l", "2"]
