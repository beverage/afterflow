# Shortcuts around the npm scripts. The dev server runs in the background:
# its PID lives in .dev.pid and its output in dev.log.
#   make up      install deps if needed, start the dev server (http://localhost:5173)
#   make down    stop the dev server
#   make re      restart it
#   make update  pull main, reinstall deps, restart if it was running
#   make logs    follow the dev server output
#   make status  is it running?
#   make build   production build (run before every commit)

PID_FILE := .dev.pid
LOG_FILE := dev.log
PORT     := 5173
VITE     := node_modules/.bin/vite

.PHONY: up down re update logs status build

node_modules: package.json package-lock.json
	npm ci
	@touch node_modules

up: node_modules
	@if [ -f $(PID_FILE) ] && kill -0 $$(cat $(PID_FILE)) 2>/dev/null; then \
		echo "Already running (PID $$(cat $(PID_FILE)))"; \
		echo ""; \
		echo "  ➜  http://localhost:$(PORT)"; \
		echo ""; \
	else \
		nohup $(VITE) --port $(PORT) --strictPort > $(LOG_FILE) 2>&1 & echo $$! > $(PID_FILE); \
		sleep 2; \
		if kill -0 $$(cat $(PID_FILE)) 2>/dev/null; then \
			echo "Afterflow is up (PID $$(cat $(PID_FILE)), logs: make logs)"; \
			echo ""; \
			echo "  ➜  http://localhost:$(PORT)"; \
			grep -a "Network:" $(LOG_FILE) | sed 's/\x1b\[[0-9;]*m//g'; \
			echo ""; \
		else \
			echo "Dev server failed to start:"; cat $(LOG_FILE); rm -f $(PID_FILE); exit 1; \
		fi; \
	fi

down:
	@if [ -f $(PID_FILE) ] && kill -0 $$(cat $(PID_FILE)) 2>/dev/null; then \
		kill $$(cat $(PID_FILE)) && echo "Stopped (PID $$(cat $(PID_FILE)))"; \
	else \
		echo "Not running"; \
	fi
	@rm -f $(PID_FILE)

re: down up

update:
	@running=0; \
	if [ -f $(PID_FILE) ] && kill -0 $$(cat $(PID_FILE)) 2>/dev/null; then running=1; $(MAKE) --no-print-directory down; fi; \
	git pull --ff-only && npm ci || exit 1; \
	if [ $$running = 1 ]; then $(MAKE) --no-print-directory up; fi

logs:
	@tail -f $(LOG_FILE)

status:
	@if [ -f $(PID_FILE) ] && kill -0 $$(cat $(PID_FILE)) 2>/dev/null; then \
		echo "Running (PID $$(cat $(PID_FILE))) at http://localhost:$(PORT)"; \
	else \
		echo "Not running"; \
	fi

build: node_modules
	npm run build
