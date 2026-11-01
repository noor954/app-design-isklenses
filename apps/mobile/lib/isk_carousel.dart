import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';

enum IskCarouselVariant {
  coverflow,
  fadeSlide,
  infiniteLoop,
  smoothSlide,
  continuous,
}

const iskCarouselInterval = Duration(seconds: 3);

IskCarouselVariant pickIskCarouselVariant([math.Random? random]) {
  const all = IskCarouselVariant.values;
  return all[(random ?? math.Random()).nextInt(all.length)];
}

/// Shared auto-advancing carousel (mirrors components/ui/shared-carousel.tsx on web).
/// Moves right-to-left every 3 seconds, pauses while touched, and honours
/// the platform "reduce motion" setting.
class IskCarousel extends StatefulWidget {
  const IskCarousel({
    super.key,
    required this.variant,
    required this.itemCount,
    required this.itemBuilder,
    this.height = 208,
    this.itemWidth = 174,
    this.hasMore = false,
    this.onNeedMore,
  });

  final IskCarouselVariant variant;
  final int itemCount;
  final Widget Function(BuildContext context, int index) itemBuilder;
  final double height;
  final double itemWidth;
  final bool hasMore;
  final VoidCallback? onNeedMore;

  @override
  State<IskCarousel> createState() => _IskCarouselState();
}

class _IskCarouselState extends State<IskCarousel>
    with SingleTickerProviderStateMixin {
  PageController? _pages;
  ScrollController? _scroll;
  Ticker? _ticker;
  Timer? _timer;
  bool _touching = false;
  Duration _last = Duration.zero;
  int _page = 0;

  bool get _looping => widget.variant == IskCarouselVariant.infiniteLoop;

  @override
  void initState() {
    super.initState();
    _configure();
  }

  @override
  void didUpdateWidget(covariant IskCarousel oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.variant != widget.variant) {
      _dispose();
      _configure();
    }
  }

  double get _fraction {
    final width = MediaQuery.maybeSizeOf(context)?.width ?? 390;
    switch (widget.variant) {
      case IskCarouselVariant.coverflow:
        return 0.56;
      case IskCarouselVariant.fadeSlide:
        return 0.82;
      default:
        return (widget.itemWidth / width).clamp(0.3, 0.9);
    }
  }

  void _configure() {
    if (widget.variant == IskCarouselVariant.continuous) {
      _scroll = ScrollController();
      _ticker = createTicker((elapsed) {
        final controller = _scroll;
        if (controller == null ||
            !controller.hasClients ||
            _touching ||
            _reduced) {
          _last = elapsed;
          return;
        }
        final dt = (elapsed - _last).inMilliseconds;
        _last = elapsed;
        controller.jumpTo(controller.offset + dt * 0.04);
      })..start();
      return;
    }
    _timer = Timer.periodic(iskCarouselInterval, (_) => _advance());
  }

  bool get _reduced =>
      mounted && (MediaQuery.maybeDisableAnimationsOf(context) ?? false);

  void _advance() {
    final controller = _pages;
    if (!mounted || controller == null || !controller.hasClients) return;
    if (_touching || _reduced || widget.itemCount < 2) return;
    final next = (controller.page?.round() ?? 0) + 1;
    if (!_looping && next >= widget.itemCount) {
      controller.animateToPage(
        0,
        duration: const Duration(milliseconds: 700),
        curve: Curves.easeOutCubic,
      );
      return;
    }
    controller.animateToPage(
      next,
      duration: const Duration(milliseconds: 650),
      curve: Curves.easeOutCubic,
    );
  }

  void _dispose() {
    _timer?.cancel();
    _ticker?.dispose();
    _pages?.dispose();
    _scroll?.dispose();
    _timer = null;
    _ticker = null;
    _pages = null;
    _scroll = null;
  }

  @override
  void dispose() {
    _dispose();
    super.dispose();
  }

  void _noteIndex(int index) {
    _page = index;
    if (widget.hasMore &&
        widget.onNeedMore != null &&
        index >= widget.itemCount - 3) {
      widget.onNeedMore!();
    }
  }

  @override
  Widget build(BuildContext context) {
    if (widget.itemCount == 0) return SizedBox(height: widget.height);
    return Semantics(
      container: true,
      child: Listener(
        onPointerDown: (_) => _touching = true,
        onPointerUp: (_) => _touching = false,
        onPointerCancel: (_) => _touching = false,
        child: SizedBox(height: widget.height, child: _body()),
      ),
    );
  }

  Widget _body() {
    final count = widget.itemCount;
    if (widget.variant == IskCarouselVariant.continuous) {
      if (widget.hasMore && widget.onNeedMore != null) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) widget.onNeedMore!();
        });
      }
      return ListView.builder(
        controller: _scroll,
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 18),
        itemBuilder: (context, index) => Padding(
          padding: const EdgeInsets.only(right: 12),
          child: SizedBox(
            width: widget.itemWidth,
            child: widget.itemBuilder(context, index % count),
          ),
        ),
      );
    }

    _pages ??= PageController(
      viewportFraction: _fraction,
      initialPage: _looping ? count * 500 : 0,
    );
    return PageView.builder(
      controller: _pages,
      padEnds: !_looping,
      itemCount: _looping ? null : count,
      onPageChanged: (index) => _noteIndex(_looping ? index % count : index),
      itemBuilder: (context, index) {
        final real = _looping ? index % count : index;
        final child = Padding(
          padding: const EdgeInsets.symmetric(horizontal: 6),
          child: widget.itemBuilder(context, real),
        );
        if (widget.variant == IskCarouselVariant.smoothSlide || _looping) {
          return child;
        }
        return AnimatedBuilder(
          animation: _pages!,
          builder: (context, _) {
            final page = _pages!.hasClients
                ? (_pages!.page ?? _page.toDouble())
                : _page.toDouble();
            final delta = (page - index).clamp(-1.0, 1.0);
            final distance = delta.abs();
            if (widget.variant == IskCarouselVariant.coverflow) {
              return Transform(
                alignment: Alignment.center,
                transform: Matrix4.identity()
                  ..setEntry(3, 2, 0.001)
                  ..rotateY(delta * 0.7)
                  ..scaleByDouble(
                    1 - distance * 0.18,
                    1 - distance * 0.18,
                    1,
                    1,
                  ),
                child: child,
              );
            }
            return Opacity(
              opacity: 1 - distance * 0.55,
              child: Transform.translate(
                offset: Offset(-delta * 26, 0),
                child: child,
              ),
            );
          },
        );
      },
    );
  }
}
