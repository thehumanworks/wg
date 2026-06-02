.PHONY: compile install

compile:
	bun run build.ts

make-executable: compile
	chmod +x ./bin/wg

install: make-executable
	cp ./bin/wg "${HOME}/.local/bin/wg"
