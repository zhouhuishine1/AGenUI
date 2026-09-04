import 'package:flutter_test/flutter_test.dart';
import 'package:flutter/widgets.dart';

import 'package:flutter_pet/main.dart';

void main() {
  testWidgets('renders the in-app pet overlay', (tester) async {
    await tester.pumpWidget(const PetOverlay());
    expect(find.byType(PetWidget), findsOneWidget);
    expect(find.byType(CustomPaint), findsOneWidget);
  });

  testWidgets('pet accepts a drag gesture', (tester) async {
    await tester.pumpWidget(const PetOverlay());
    await tester.pump(const Duration(milliseconds: 50));
    final pet = find.byType(PetWidget);
    await tester.drag(pet, const Offset(-20, 20));
    await tester.pump();
    expect(find.byType(PetWidget), findsOneWidget);
  });
}
