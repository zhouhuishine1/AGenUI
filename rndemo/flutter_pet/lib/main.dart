import 'dart:async';
import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

enum PetAnimationState { idle, running, review }

void main() => runApp(const PetOverlay());

class PetOverlay extends StatelessWidget {
  const PetOverlay({super.key});

  @override
  Widget build(BuildContext context) => const Directionality(
        textDirection: TextDirection.ltr,
        child: Material(
          color: Colors.transparent,
          child: Stack(children: [PetWidget()]),
        ),
      );
}

class PetWidget extends StatefulWidget {
  const PetWidget({super.key});

  @override
  State<PetWidget> createState() => _PetWidgetState();
}

class _PetWidgetState extends State<PetWidget> {
  static const double _petSize = 112;
  ui.Image? _spritesheet;
  Timer? _timer;
  PetAnimationState _state = PetAnimationState.idle;
  int _frame = 0;
  Offset _position = Offset.zero;
  bool _positionInitialized = false;
  bool _dragging = false;
  Offset? _pointerStart;
  Offset _positionAtPointerStart = Offset.zero;

  @override
  void initState() {
    super.initState();
    _loadSpritesheet();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _start(PetAnimationState.idle);
    });
  }

  Future<void> _loadSpritesheet() async {
    final data = await rootBundle.load('assets/corgi/spritesheet.webp');
    final codec = await ui.instantiateImageCodec(data.buffer.asUint8List());
    final decoded = await codec.getNextFrame();
    if (mounted) setState(() => _spritesheet = decoded.image);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final size = MediaQuery.sizeOf(context);
    if (!_positionInitialized && size.width > _petSize && size.height > _petSize) {
      final maxX = math.max(0.0, size.width - _petSize);
      _position = Offset(math.max(0.0, size.width - _petSize - 16).clamp(0.0, maxX), 96);
      _positionInitialized = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) setState(() {});
      });
    }
  }

  void _start(PetAnimationState state, {bool oneShot = false}) {
    _timer?.cancel();
    _state = state;
    _frame = 0;
    _timer = Timer.periodic(const Duration(milliseconds: 100), (timer) {
      if (!mounted) return timer.cancel();
      if (oneShot && _frame == 5) {
        timer.cancel();
        setState(() {
          _state = PetAnimationState.idle;
          _frame = 0;
        });
      } else {
        setState(() => _frame = (_frame + 1) % 6);
      }
    });
    setState(() {});
  }

  void _pointerDown(PointerDownEvent event) {
    _pointerStart = event.localPosition;
    _positionAtPointerStart = _position;
    _dragging = false;
  }

  void _pointerMove(PointerMoveEvent event) {
    final start = _pointerStart;
    if (start == null) return;
    final delta = event.localPosition - start;
    if (!_dragging && delta.distance < 4) return;
    if (!_dragging) {
      _dragging = true;
      _start(PetAnimationState.running);
    }
    final size = MediaQuery.sizeOf(context);
    final next = _positionAtPointerStart + delta;
    final maxX = math.max(0.0, size.width - _petSize);
    final maxY = math.max(0.0, size.height - _petSize);
    setState(() => _position = Offset(
          next.dx.clamp(0.0, maxX),
          next.dy.clamp(0.0, maxY),
        ));
  }

  void _pointerUp(PointerUpEvent event) {
    if (!_dragging) _start(PetAnimationState.review, oneShot: true);
    _dragging = false;
    _pointerStart = null;
    if (_state == PetAnimationState.running) _start(PetAnimationState.idle);
  }

  void _pointerCancel(PointerCancelEvent event) {
    _dragging = false;
    _pointerStart = null;
    _start(PetAnimationState.idle);
  }

  @override
  Widget build(BuildContext context) => Positioned(
        left: _position.dx,
        top: _position.dy,
        width: _petSize,
        height: _petSize,
        child: Listener(
          behavior: HitTestBehavior.opaque,
          onPointerDown: _pointerDown,
          onPointerMove: _pointerMove,
          onPointerUp: _pointerUp,
          onPointerCancel: _pointerCancel,
          child: CustomPaint(painter: _PetPainter(_spritesheet, _state, _frame)),
        ),
      );

  @override
  void dispose() {
    _timer?.cancel();
    _spritesheet?.dispose();
    super.dispose();
  }
}

class _PetPainter extends CustomPainter {
  const _PetPainter(this.image, this.state, this.frame);

  final ui.Image? image;
  final PetAnimationState state;
  final int frame;

  @override
  void paint(Canvas canvas, Size size) {
    if (image == null) return;
    final row = switch (state) {
      PetAnimationState.idle => 0,
      PetAnimationState.running => 7,
      PetAnimationState.review => 8,
    };
    final source = Rect.fromLTWH(frame * 192, row * 208, 192, 208);
    canvas.drawImageRect(image!, source, Offset.zero & size, Paint()..filterQuality = FilterQuality.none);
  }

  @override
  bool shouldRepaint(covariant _PetPainter oldDelegate) =>
      oldDelegate.image != image || oldDelegate.state != state || oldDelegate.frame != frame;
}
