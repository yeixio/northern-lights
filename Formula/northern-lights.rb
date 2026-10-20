# Homebrew formula. This repository doubles as a tap:
#
#   brew tap yeixio/northern-lights https://github.com/yeixio/northern-lights
#   brew install northern-lights
#
# The release workflow updates url and sha256 for each v* tag.
class NorthernLights < Formula
  desc "Self-hosted personal social site with a private, invite-only network"
  homepage "https://github.com/yeixio/northern-lights"
  url "https://github.com/yeixio/northern-lights/archive/refs/tags/v0.1.0.tar.gz"
  sha256 "0000000000000000000000000000000000000000000000000000000000000000"
  license "MIT"
  head "https://github.com/yeixio/northern-lights.git", branch: "main"

  depends_on "node@22"

  def install
    node = Formula["node@22"]
    ENV.prepend_path "PATH", node.opt_bin
    system "npm", "ci", *std_npm_args(prefix: false)
    system "npm", "run", "build"
    system "npm", "prune", "--omit=dev"

    # better-sqlite3 ships prebuilt binaries for every platform; keep this one.
    platform = "#{OS.mac? ? "darwin" : "linux"}-#{Hardware::CPU.arm? ? "arm64" : "x64"}.node"
    Dir["node_modules/better-sqlite3/prebuilds/*"].each { |f| rm f if File.basename(f) != platform }

    libexec.install "package.json", "dist", "node_modules"
    (bin/"northern-lights").write <<~SH
      #!/bin/bash
      export NODE_ENV="${NODE_ENV:-production}"
      export ENV_FILE="${ENV_FILE:-#{etc}/northern-lights.env}"
      export DATA_DIR="${DATA_DIR:-#{var}/northern-lights}"
      export CLIENT_DIR="${CLIENT_DIR:-#{libexec}/dist/client}"
      exec "#{node.opt_bin}/node" "#{libexec}/dist/server/index.js" "$@"
    SH
  end

  def post_install
    (var/"northern-lights").mkpath
    return if (etc/"northern-lights.env").exist?

    (etc/"northern-lights.env").write <<~EOS
      # Northern Lights settings. Every setting is optional; see
      # https://github.com/yeixio/northern-lights#configuration
      # After changing this file: brew services restart northern-lights
      PORT=3000
      # APP_URL=https://family.example.com
      # DATABASE_URL=postgres://user:password@localhost:5432/northern_lights
      # SMTP_URL=smtps://user:password@smtp.example.com:465
      # MAIL_FROM="Northern Lights <no-reply@example.com>"
    EOS
  end

  def caveats
    <<~EOS
      Settings: #{etc}/northern-lights.env
      Data (SQLite database and uploads): #{var}/northern-lights

      After starting it, open http://localhost:3000 to create the admin account.
    EOS
  end

  service do
    run opt_bin/"northern-lights"
    keep_alive true
    working_dir var/"northern-lights"
    log_path var/"log/northern-lights.log"
    error_log_path var/"log/northern-lights.log"
  end

  test do
    port = free_port
    pid = spawn({ "PORT" => port.to_s, "DATA_DIR" => testpath.to_s, "ENV_FILE" => "/dev/null" },
                 bin/"northern-lights")
    sleep 5
    assert_match "needsSetup", shell_output("curl -s http://127.0.0.1:#{port}/api/auth/session")
  ensure
    Process.kill("TERM", pid)
    Process.wait(pid)
  end
end
