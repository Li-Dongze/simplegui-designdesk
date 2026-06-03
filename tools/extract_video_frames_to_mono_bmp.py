#!/usr/bin/env python3
"""
Extract every frame from a video, convert to 1-bit monochrome BMP, and emit a manifest.

Usage:
  python tools/extract_video_frames_to_mono_bmp.py \
    --input F:/path/video.mp4 \
    --output-dir public/wallpaper_frames \
    --width 128 --height 64
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
import math
import shutil
import uuid
from pathlib import Path
from typing import Literal

import cv2
import numpy as np
from PIL import Image, ImageOps


FitMode = Literal["stretch", "contain", "cover"]
RenderStyle = Literal["plain", "sketch", "lineart", "stroke"]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Extract MP4 frames and convert to 1-bit BMP.")
    parser.add_argument("--input", required=True, help="Input video file path.")
    parser.add_argument("--output-dir", required=True, help="Output directory for BMP frames.")
    parser.add_argument("--width", type=int, default=128, help="Output width.")
    parser.add_argument("--height", type=int, default=64, help="Output height.")
    parser.add_argument(
        "--fit",
        choices=["stretch", "contain", "cover"],
        default="cover",
        help="Resize mode to map source frame into target size.",
    )
    parser.add_argument("--threshold", type=int, default=128, help="Binarization threshold (0-255).")
    parser.add_argument(
        "--style",
        choices=["plain", "sketch", "lineart", "stroke"],
        default="stroke",
        help="Rendering style: plain threshold/dither, sketch texture, lineart, or stroke-by-stroke contour drawing.",
    )
    parser.add_argument(
        "--no-dither",
        action="store_true",
        help="Disable Floyd-Steinberg dithering.",
    )
    parser.add_argument(
        "--clear",
        action="store_true",
        help="Remove existing .bmp/.json files in output directory before generation.",
    )
    parser.add_argument(
        "--copy-to-ascii-path",
        action="store_true",
        help="Copy input video to a temp ASCII path before opening (for Unicode path compatibility on Windows/OpenCV).",
    )
    return parser.parse_args()


def resolve_path(path_value: str) -> Path:
    return Path(path_value).expanduser().resolve()


def resize_frame(frame: Image.Image, width: int, height: int, fit: FitMode) -> Image.Image:
    if fit == "stretch":
        return frame.resize((width, height), Image.Resampling.LANCZOS)

    src_w, src_h = frame.size
    src_ratio = src_w / src_h
    dst_ratio = width / height

    if fit == "contain":
        if src_ratio > dst_ratio:
            scaled_w = width
            scaled_h = max(1, int(round(width / src_ratio)))
        else:
            scaled_h = height
            scaled_w = max(1, int(round(height * src_ratio)))
        scaled = frame.resize((scaled_w, scaled_h), Image.Resampling.LANCZOS)
        canvas = Image.new("RGB", (width, height), (255, 255, 255))
        offset_x = (width - scaled_w) // 2
        offset_y = (height - scaled_h) // 2
        canvas.paste(scaled, (offset_x, offset_y))
        return canvas

    # cover
    if src_ratio > dst_ratio:
        scaled_h = height
        scaled_w = max(1, int(round(height * src_ratio)))
    else:
        scaled_w = width
        scaled_h = max(1, int(round(width / src_ratio)))

    scaled = frame.resize((scaled_w, scaled_h), Image.Resampling.LANCZOS)
    crop_x = max(0, (scaled_w - width) // 2)
    crop_y = max(0, (scaled_h - height) // 2)
    return scaled.crop((crop_x, crop_y, crop_x + width, crop_y + height))


def _auto_canny(image: np.ndarray) -> np.ndarray:
    median = float(np.median(image))
    low = int(max(8, min(120, 0.66 * median)))
    high = int(max(low + 1, min(255, 1.33 * median)))
    return cv2.Canny(image, low, high, L2gradient=True)


def _remove_speckles(binary: np.ndarray, min_area: int = 2) -> np.ndarray:
    if min_area <= 1:
        return binary

    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(binary, connectivity=8)
    cleaned = np.zeros_like(binary)
    for label in range(1, num_labels):
        area = stats[label, cv2.CC_STAT_AREA]
        if area >= min_area:
            cleaned[labels == label] = 255
    return cleaned


def _robust_contrast(gray_raw: np.ndarray, low_pct: float = 2.0, high_pct: float = 98.0) -> np.ndarray:
    p_low, p_high = np.percentile(gray_raw, (low_pct, high_pct))
    if p_high - p_low < 8:
        return gray_raw
    stretched = np.clip((gray_raw.astype(np.float32) - p_low) * 255.0 / (p_high - p_low), 0, 255)
    return stretched.astype(np.uint8)


def _unsharp_mask(gray: np.ndarray, sigma: float = 0.85, amount: float = 1.4) -> np.ndarray:
    blur = cv2.GaussianBlur(gray, (0, 0), sigmaX=sigma, sigmaY=sigma)
    sharp = cv2.addWeighted(gray, 1.0 + amount, blur, -amount, 0)
    return np.clip(sharp, 0, 255).astype(np.uint8)


def _morph_skeleton(binary: np.ndarray, max_steps: int = 64) -> np.ndarray:
    work = np.where(binary > 0, 255, 0).astype(np.uint8)
    skeleton = np.zeros_like(work)
    kernel = cv2.getStructuringElement(cv2.MORPH_CROSS, (3, 3))

    steps = 0
    while True:
        eroded = cv2.erode(work, kernel)
        opened = cv2.dilate(eroded, kernel)
        edge = cv2.subtract(work, opened)
        skeleton = cv2.bitwise_or(skeleton, edge)
        work = eroded
        steps += 1
        if cv2.countNonZero(work) == 0 or steps >= max_steps:
            break

    return skeleton


def _render_sketch_mask(grayscale: Image.Image, threshold: int, dither: bool) -> np.ndarray:
    gray_raw = np.array(grayscale, dtype=np.uint8)
    gray = _robust_contrast(gray_raw, low_pct=2.0, high_pct=98.0)

    # Slight brightness lift helps low-light videos expose line structures.
    gamma = 0.78
    gray = np.clip((gray.astype(np.float32) / 255.0) ** gamma * 255.0, 0, 255).astype(np.uint8)

    # Improve local contrast while keeping global luminance stable.
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(4, 4))
    enhanced = clahe.apply(gray)

    # Light denoise that preserves hard transitions (strokes).
    smoothed = cv2.bilateralFilter(enhanced, d=5, sigmaColor=40, sigmaSpace=40)

    # Base shape map: local threshold keeps major silhouettes.
    base = cv2.adaptiveThreshold(
        smoothed,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV,
        9,
        2,
    )

    # Stroke map: strong edges and gradient edges to keep single lines complete.
    canny = _auto_canny(smoothed)
    canny = cv2.morphologyEx(canny, cv2.MORPH_CLOSE, np.ones((2, 2), np.uint8), iterations=1)

    morph_grad = cv2.morphologyEx(smoothed, cv2.MORPH_GRADIENT, np.ones((3, 3), np.uint8))
    _, grad_edges = cv2.threshold(morph_grad, 26, 255, cv2.THRESH_BINARY)

    # Dense texture approximation via dithering in darker zones.
    if dither:
        dither_img = grayscale.convert("1", dither=Image.Dither.FLOYDSTEINBERG)
        dither_l = np.array(dither_img.convert("L"), dtype=np.uint8)
    else:
        clipped = grayscale.point(lambda p: 255 if p >= threshold else 0, mode="L")
        dither_l = np.array(clipped, dtype=np.uint8)

    dither_foreground = np.where(dither_l < 128, 255, 0).astype(np.uint8)
    midtone_mask = cv2.inRange(smoothed, 40, 190)
    dense = cv2.bitwise_and(dither_foreground, midtone_mask)

    combined = cv2.bitwise_or(base, canny)
    combined = cv2.bitwise_or(combined, grad_edges)
    combined = cv2.bitwise_or(combined, dense)

    # Guardrail: avoid full-frame saturation on ultra-dark scenes.
    if float((combined > 0).mean()) > 0.82:
        combined = cv2.bitwise_or(base, canny)
        combined = cv2.bitwise_or(combined, grad_edges)

    # Keep thin lines while dropping isolated spark noise.
    combined = _remove_speckles(combined, min_area=2)
    return combined


def _render_lineart_mask(grayscale: Image.Image) -> np.ndarray:
    gray_raw = np.array(grayscale, dtype=np.uint8)
    gray = _robust_contrast(gray_raw, low_pct=1.0, high_pct=99.0)
    gray = _unsharp_mask(gray, sigma=0.75, amount=1.75)

    # Pull dark strokes down so single-pixel lines survive final binarization.
    dark_probe = cv2.erode(gray, np.ones((2, 2), np.uint8), iterations=1)
    merged = np.minimum(gray, np.clip(dark_probe.astype(np.int16) + 14, 0, 255).astype(np.uint8))

    local = cv2.adaptiveThreshold(
        merged,
        255,
        cv2.ADAPTIVE_THRESH_MEAN_C,
        cv2.THRESH_BINARY_INV,
        9,
        6,
    )
    local_dark = cv2.bitwise_and(local, cv2.inRange(merged, 0, 130))
    local_dark = _remove_speckles(local_dark, min_area=2)
    local_strokes = _morph_skeleton(local_dark, max_steps=64)

    canny = _auto_canny(merged)
    canny = cv2.dilate(canny, np.ones((2, 2), np.uint8), iterations=1)
    canny = cv2.morphologyEx(canny, cv2.MORPH_CLOSE, np.ones((2, 2), np.uint8), iterations=1)

    gradient = cv2.morphologyEx(merged, cv2.MORPH_GRADIENT, np.ones((3, 3), np.uint8))
    _, grad_edges = cv2.threshold(gradient, 20, 255, cv2.THRESH_BINARY)

    combined = cv2.bitwise_or(local_strokes, canny)
    combined = cv2.bitwise_or(combined, grad_edges)
    combined = _remove_speckles(combined, min_area=3)

    # Skeletonize then merge back strong edges: this keeps strokes crisp without large fuzzy fills.
    skeleton = _morph_skeleton(combined, max_steps=64)
    combined = cv2.bitwise_or(skeleton, canny)
    combined = cv2.bitwise_or(combined, local_strokes)
    combined = cv2.morphologyEx(combined, cv2.MORPH_CLOSE, np.ones((2, 2), np.uint8), iterations=1)
    combined = _remove_speckles(combined, min_area=3)

    # Guardrail for over-saturated frames.
    density = float((combined > 0).mean())
    if density > 0.45:
        _, fallback = cv2.threshold(merged, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        edge_only = cv2.bitwise_or(canny, grad_edges)
        fallback = cv2.bitwise_and(fallback, cv2.inRange(merged, 0, 110))
        fallback = cv2.bitwise_or(_morph_skeleton(fallback, max_steps=64), edge_only)
        combined = _remove_speckles(fallback, min_area=3)

    return combined


def _trace_contours_to_strokes(
    seed_mask: np.ndarray,
    *,
    external_only: bool = False,
    min_perimeter: float = 5.0,
) -> np.ndarray:
    retrieval_mode = cv2.RETR_EXTERNAL if external_only else cv2.RETR_LIST
    contours, _ = cv2.findContours(seed_mask, retrieval_mode, cv2.CHAIN_APPROX_NONE)
    canvas = np.zeros_like(seed_mask)

    if not contours:
        return canvas

    contours = sorted(contours, key=lambda contour: cv2.arcLength(contour, True), reverse=True)
    for contour in contours:
        perimeter = float(cv2.arcLength(contour, True))
        if perimeter < min_perimeter:
            continue

        epsilon = max(0.35, min(1.8, perimeter * 0.018))
        simplified = cv2.approxPolyDP(contour, epsilon, True)
        if simplified.shape[0] < 2:
            continue

        # Keep closed loops for areas, open polyline for strip-like details.
        is_closed = abs(float(cv2.contourArea(contour))) > 2.0
        cv2.polylines(canvas, [simplified], is_closed, 255, 1, lineType=cv2.LINE_8)

    return canvas


def _stamp_rect(canvas: np.ndarray, x: int, y: int, size: int = 2) -> None:
    h, w = canvas.shape[:2]
    size = max(1, int(size))
    half = size // 2

    x0 = max(0, int(x) - half)
    y0 = max(0, int(y) - half)
    x1 = min(w, x0 + size)
    y1 = min(h, y0 + size)
    if x0 < x1 and y0 < y1:
        canvas[y0:y1, x0:x1] = 255


def _draw_rect_line(
    canvas: np.ndarray,
    x1: int,
    y1: int,
    x2: int,
    y2: int,
    *,
    rect_size: int = 2,
    step_px: float = 2.0,
) -> None:
    dx = float(x2 - x1)
    dy = float(y2 - y1)
    dist = float(math.hypot(dx, dy))

    if dist < 0.5:
        _stamp_rect(canvas, x1, y1, size=rect_size)
        return

    step = max(0.8, float(step_px))
    segments = max(1, int(math.ceil(dist / step)))
    for i in range(segments + 1):
        t = i / segments
        x = int(round(x1 + dx * t))
        y = int(round(y1 + dy * t))
        _stamp_rect(canvas, x, y, size=rect_size)


def _reinforce_long_lines_as_rects(edge_mask: np.ndarray) -> np.ndarray:
    overlay = np.zeros_like(edge_mask)
    hough_lines = cv2.HoughLinesP(
        edge_mask,
        rho=1,
        theta=np.pi / 180.0,
        threshold=10,
        minLineLength=8,
        maxLineGap=3,
    )
    if hough_lines is None:
        return overlay

    line_items: list[tuple[float, int, int, int, int]] = []
    for line in hough_lines[:, 0]:
        x1, y1, x2, y2 = (int(v) for v in line)
        length = float(math.hypot(x2 - x1, y2 - y1))
        if length < 8.0:
            continue
        line_items.append((length, x1, y1, x2, y2))

    line_items.sort(key=lambda item: item[0], reverse=True)
    for length, x1, y1, x2, y2 in line_items[:80]:
        rect_size = 2 if length < 24 else 3
        step_px = 1.3 if length < 24 else 1.0
        _draw_rect_line(overlay, x1, y1, x2, y2, rect_size=rect_size, step_px=step_px)

    return overlay


def _reinforce_arcs_as_rects(outline_mask: np.ndarray) -> np.ndarray:
    overlay = np.zeros_like(outline_mask)
    contours, _ = cv2.findContours(outline_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    if not contours:
        return overlay

    h, w = outline_mask.shape[:2]

    for contour in contours:
        if contour.shape[0] < 18:
            continue

        perimeter = float(cv2.arcLength(contour, True))
        if perimeter < 18.0:
            continue

        area = abs(float(cv2.contourArea(contour)))
        if area < 12.0:
            continue

        x, y, bw, bh = cv2.boundingRect(contour)
        if bw < 6 or bh < 4:
            continue

        aspect = float(max(bw, bh)) / max(1.0, float(min(bw, bh)))
        if aspect > 5.5:
            continue

        if contour.shape[0] < 5:
            continue

        try:
            (cx, cy), (axis_a, axis_b), angle_deg = cv2.fitEllipse(contour)
        except cv2.error:
            continue

        major = max(axis_a, axis_b) * 0.5
        minor = min(axis_a, axis_b) * 0.5
        if major < 3.0 or minor < 2.0:
            continue

        theta = math.radians(float(angle_deg))
        cos_t = math.cos(theta)
        sin_t = math.sin(theta)

        step_deg = 6 if major < 12 else 4
        for deg in range(0, 360, step_deg):
            rad = math.radians(float(deg))
            ex = major * math.cos(rad)
            ey = minor * math.sin(rad)
            px = int(round(cx + ex * cos_t - ey * sin_t))
            py = int(round(cy + ex * sin_t + ey * cos_t))

            if px < 0 or px >= w or py < 0 or py >= h:
                continue

            # Keep only arc points that are near existing outline pixels.
            x0 = max(0, px - 2)
            y0 = max(0, py - 2)
            x1 = min(w, px + 3)
            y1 = min(h, py + 3)
            if int(np.count_nonzero(outline_mask[y0:y1, x0:x1])) == 0:
                continue

            rect_size = 2 if major < 16 else 3
            _stamp_rect(overlay, px, py, size=rect_size)

    return overlay


def _render_stroke_mask(grayscale: Image.Image) -> np.ndarray:
    gray_raw = np.array(grayscale, dtype=np.uint8)
    gray = _robust_contrast(gray_raw, low_pct=0.8, high_pct=99.2)
    gray = _unsharp_mask(gray, sigma=0.7, amount=2.1)
    smooth = cv2.GaussianBlur(gray, (3, 3), sigmaX=0.6, sigmaY=0.6)

    # 1) Build dark-object mask and keep only the outer contour strokes.
    _, otsu_inv = cv2.threshold(smooth, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    hard_dark = cv2.inRange(smooth, 0, 132)
    region = cv2.bitwise_or(otsu_inv, hard_dark)
    region = cv2.morphologyEx(region, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8), iterations=1)
    region = cv2.morphologyEx(region, cv2.MORPH_CLOSE, np.ones((2, 2), np.uint8), iterations=1)
    region = _remove_speckles(region, min_area=4)

    outline = cv2.morphologyEx(region, cv2.MORPH_GRADIENT, np.ones((3, 3), np.uint8))
    outline = _remove_speckles(outline, min_area=2)

    # 2) Convert the outline map to stroke-by-stroke polylines.
    stroke_canvas = _trace_contours_to_strokes(outline, external_only=True, min_perimeter=6.0)

    # 3) Strong reinforcement: long straight lines rendered as dense small rectangles.
    canny = _auto_canny(smooth)
    boundary_band = cv2.dilate(outline, np.ones((3, 3), np.uint8), iterations=1)
    canny_near_outline = cv2.bitwise_and(canny, boundary_band)
    line_overlay = _reinforce_long_lines_as_rects(canny_near_outline)
    stroke_canvas = cv2.bitwise_or(stroke_canvas, line_overlay)

    # 4) Arc reinforcement: simplify curved perimeter by rectangle stamping on fitted ellipse arcs.
    arc_overlay = _reinforce_arcs_as_rects(outline)
    stroke_canvas = cv2.bitwise_or(stroke_canvas, arc_overlay)

    stroke_canvas = _remove_speckles(stroke_canvas, min_area=2)

    # Guardrail: if density is still too high, keep simplified perimeter + strong line/arc overlays.
    density = float((stroke_canvas > 0).mean())
    if density > 0.22:
        sparse = _trace_contours_to_strokes(outline, external_only=True, min_perimeter=8.0)
        sparse = cv2.bitwise_or(sparse, line_overlay)
        sparse = cv2.bitwise_or(sparse, arc_overlay)
        stroke_canvas = _remove_speckles(sparse, min_area=2)

    return stroke_canvas


def to_mono_bmp_bits_black(
    image: Image.Image,
    threshold: int,
    dither: bool,
    style: RenderStyle,
) -> Image.Image:
    grayscale = ImageOps.autocontrast(image.convert("L"))
    if style == "plain":
        if dither:
            bw = grayscale.convert("1", dither=Image.Dither.FLOYDSTEINBERG)
        else:
            clipped = grayscale.point(lambda p: 255 if p >= threshold else 0, mode="L")
            bw = clipped.convert("1", dither=Image.Dither.NONE)
    elif style == "sketch":
        mask = _render_sketch_mask(grayscale, threshold=threshold, dither=dither)
        # mask=255 means dark stroke; convert to standard monochrome where 0 is black.
        bw_l = np.where(mask > 0, 0, 255).astype(np.uint8)
        bw = Image.fromarray(bw_l, mode="L").convert("1", dither=Image.Dither.NONE)
    elif style == "lineart":
        mask = _render_lineart_mask(grayscale)
        bw_l = np.where(mask > 0, 0, 255).astype(np.uint8)
        bw = Image.fromarray(bw_l, mode="L").convert("1", dither=Image.Dither.NONE)
    else:
        mask = _render_stroke_mask(grayscale)
        bw_l = np.where(mask > 0, 0, 255).astype(np.uint8)
        bw = Image.fromarray(bw_l, mode="L").convert("1", dither=Image.Dither.NONE)

    # In Pillow mode "1", bit=1 means white. The simulator treats bit=1 as lit/foreground.
    # Invert so bit=1 maps to dark pixels (black foreground), matching existing resources.
    inverted = ImageOps.invert(bw.convert("L")).convert("1", dither=Image.Dither.NONE)
    return inverted


def maybe_prepare_ascii_copy(input_video: Path) -> Path:
    temp_copy = input_video.parent / f"{input_video.stem}_ascii_tmp_{uuid.uuid4().hex}{input_video.suffix}"
    shutil.copy2(input_video, temp_copy)
    return temp_copy


def main() -> None:
    args = parse_args()
    input_video = resolve_path(args.input)
    output_dir = resolve_path(args.output_dir)

    if not input_video.is_file():
        raise FileNotFoundError(f"Input video not found: {input_video}")

    if args.width <= 0 or args.height <= 0:
        raise ValueError("width/height must be positive.")

    threshold = max(0, min(255, int(args.threshold)))
    fit: FitMode = args.fit
    style: RenderStyle = args.style
    dither = not args.no_dither

    output_dir.mkdir(parents=True, exist_ok=True)
    if args.clear:
        for entry in output_dir.iterdir():
            if entry.suffix.lower() in {".bmp", ".json"}:
                entry.unlink()

    working_video = input_video
    temp_copied = None
    if args.copy_to_ascii_path:
        temp_copied = maybe_prepare_ascii_copy(input_video)
        working_video = temp_copied

    cap = cv2.VideoCapture(str(working_video))
    if not cap.isOpened():
        if temp_copied and temp_copied.exists():
            temp_copied.unlink(missing_ok=True)
        raise RuntimeError(f"Failed to open video: {working_video}")

    fps = float(cap.get(cv2.CAP_PROP_FPS) or 0.0)
    if not math.isfinite(fps) or fps <= 0:
        fps = 24.0

    frame_count_prop = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    src_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
    src_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)

    frame_files: list[str] = []
    index = 0

    try:
        while True:
            ok, frame_bgr = cap.read()
            if not ok:
                break

            index += 1
            frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
            pil_frame = Image.fromarray(frame_rgb, mode="RGB")
            resized = resize_frame(pil_frame, args.width, args.height, fit)
            mono = to_mono_bmp_bits_black(
                resized,
                threshold=threshold,
                dither=dither,
                style=style,
            )

            file_name = f"frame_{index:04d}.bmp"
            out_path = output_dir / file_name
            mono.save(out_path, format="BMP")
            frame_files.append(file_name)
    finally:
        cap.release()
        if temp_copied and temp_copied.exists():
            temp_copied.unlink(missing_ok=True)

    manifest = {
        "sourceFile": input_video.name,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "fitMode": fit,
        "style": style,
        "width": args.width,
        "height": args.height,
        "fps": fps,
        "frameCount": len(frame_files),
        "sourceFrameCount": frame_count_prop,
        "sourceWidth": src_width,
        "sourceHeight": src_height,
        "files": frame_files,
    }
    manifest_path = output_dir / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    print("Video frame extraction complete.")
    print(f"Input: {input_video}")
    print(f"Output directory: {output_dir}")
    print(f"Generated frames: {len(frame_files)}")
    print(f"Output size: {args.width}x{args.height}, FPS: {fps:.3f}")
    print(f"Manifest: {manifest_path}")


if __name__ == "__main__":
    main()
