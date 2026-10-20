Pod::Spec.new do |s|
  s.name = 'JetsonaInput'
  s.version = '1.0.0'
  s.summary = 'Jetsona hardware input for iOS'
  s.description = 'Game Controller input forwarding for Jetsona.'
  s.license = { :type => 'MIT' }
  s.author = 'Jetsona'
  s.homepage = 'https://protexa.cloud'
  s.source = { :git => 'https://protexa.cloud/jetsona.git' }
  s.platform = :ios, '16.4'
  s.swift_version = '5.9'
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'GameController', 'CoreHaptics', 'AVFoundation', 'UIKit'
  s.source_files = '**/*.swift'
end
