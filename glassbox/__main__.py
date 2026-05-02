"""Allow `python -m glassbox` to launch the window."""
import argparse
import sys

from glassbox import GlassboxError, open as glassbox_open


def main() -> None:
    parser = argparse.ArgumentParser(prog="glassbox")
    parser.add_argument(
        "model_path",
        nargs="?",
        default=None,
        help="Optional path to a trained model. Validated for existence; "
             "the live audit reads bias_report.json at the project root.",
    )
    parser.add_argument(
        "--dev",
        action="store_true",
        help="Load frontend from http://localhost:5173 instead of the bundled build.",
    )
    args = parser.parse_args()
    try:
        glassbox_open(model_path=args.model_path, dev=args.dev)
    except GlassboxError as err:
        print(f"glassbox: {err}", file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
