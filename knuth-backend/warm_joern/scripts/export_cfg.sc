// Joern script template for exporting CFG in DOT format.
// Expected params: inputFile, language, filename
// Usage example (wrapper sets this automatically):
// joern --script export_cfg.sc --params inputFile=/tmp/main.c,language=c,filename=main.c

import io.shiftleft.semanticcpg.language._

@main def run(inputFile: String, language: String = "c", filename: String = "source"): Unit = {
  importCode(inputFile)

  val method = language.toLowerCase match {
    case "c" | "cpp" =>
      cpg.method.nameExact("main").headOption.orElse(cpg.method.headOption)
    case "java" =>
      cpg.method
        .where(_.nameExact("main"))
        .where(_.fullName(".*main.*"))
        .headOption
        .orElse(cpg.method.headOption)
    case "python" =>
      cpg.method.headOption
    case "javascript" =>
      cpg.method.headOption
    case _ =>
      cpg.method.headOption
  }

  method match {
    case Some(m) =>
      val dot = m.dotCfg.l.mkString("\n")
      println("__CFG_DOT_START__")
      println(dot)
      println("__CFG_DOT_END__")
    case None =>
      throw new RuntimeException("No method found for CFG extraction")
  }
}
