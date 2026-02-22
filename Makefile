.PHONY: dev stop db logs clean

# Start the full dev environment (Postgres + backend + frontend, hot reload)
dev:
	./dev.sh

# Start only Postgres
db:
	docker compose -f docker-compose.dev.yml up -d --wait

# Stop Postgres
stop:
	docker compose -f docker-compose.dev.yml down

# Tail Postgres logs
logs:
	docker compose -f docker-compose.dev.yml logs -f

# Wipe Postgres data volume and dep checksums
clean:
	docker compose -f docker-compose.dev.yml down -v
	rm -rf .dev-state
