"""Allow `python -m glassbox` to launch the window."""
import argparse

from glassbox import open as glassbox_open


def main() -> None:
    parser = argparse.ArgumentParser(prog="glassbox")
    parser.add_argument("model_path", nargs="?", default=None,
                        help="Optional path to a trained model. Phase 1 ignores this.")
    parser.add_argument("--dev", action="store_true",
                        help="Load frontend from http://localhost:5173 instead of the bundled build.")
    args = parser.parse_args()
    glassbox_open(model_path=args.model_path, dev=args.dev)


if __name__ == "__main__":
    main()
